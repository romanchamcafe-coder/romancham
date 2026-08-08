-- ============================================================
-- Romancham — Phase 2: Activity Log / Audit Trail
-- Append-only. Automatic capture on business tables via triggers,
-- plus an app-level RPC for auth/team events (carries IP + user agent).
-- ============================================================

-- 1) Extend audit_logs with the full audit column set.
alter table audit_logs add column if not exists branch_id uuid references branches(id) on delete set null;
alter table audit_logs add column if not exists old_value jsonb;
alter table audit_logs add column if not exists new_value jsonb;
alter table audit_logs add column if not exists ip text;
alter table audit_logs add column if not exists user_agent text;
create index if not exists audit_logs_org_created_idx on audit_logs(org_id, created_at desc);
create index if not exists audit_logs_entity_idx on audit_logs(org_id, entity);

-- 2) Append-only guard: block any UPDATE/DELETE on audit_logs.
create or replace function public.audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end; $$;
drop trigger if exists audit_no_change on audit_logs;
create trigger audit_no_change before update or delete on audit_logs
  for each row execute function public.audit_immutable();

-- 3) Generic row auditor. Derives org/branch/record from the row JSON so it
--    works for every table (organizations included). Runs as definer to write.
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare j_old jsonb; j_new jsonb; j jsonb; v_org uuid; v_branch uuid; v_id uuid;
begin
  if TG_OP = 'DELETE' then j_old := to_jsonb(OLD); j_new := null;
  elsif TG_OP = 'UPDATE' then j_old := to_jsonb(OLD); j_new := to_jsonb(NEW);
  else j_old := null; j_new := to_jsonb(NEW); end if;
  j := coalesce(j_new, j_old);

  v_org := coalesce(nullif(j->>'org_id',''), nullif(j->>'id',''))::uuid;
  v_branch := nullif(j->>'branch_id','')::uuid;
  v_id := nullif(j->>'id','')::uuid;

  insert into audit_logs(org_id, branch_id, user_id, action, entity, entity_id, old_value, new_value, ip, user_agent)
  values (v_org, v_branch, auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_id, j_old, j_new,
          nullif(current_setting('app.client_ip', true), ''),
          nullif(current_setting('app.client_ua', true), ''));
  return coalesce(NEW, OLD);
end; $$;

-- 4) Attach the auditor to business tables (team/invitations are logged at the
--    app layer instead, to carry IP/user-agent without double entries).
do $$
declare t text;
begin
  for t in select unnest(array[
    'organizations','branches','ingredients','vendors','vendor_ingredients','categories','units',
    'purchases','sales','expenses','stock_adjustments','productions',
    'ops_cash_recon','ops_wastage','ops_indents','ops_purchase_requests','ops_checklist_runs'])
  loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists trg_audit on public.%I;', t);
      execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.audit_row();', t);
    end if;
  end loop;
end $$;

-- 5) App-level audit writer for events that carry client context (login, team).
create or replace function public.log_audit(
  p_org uuid, p_branch uuid, p_action text, p_entity text, p_entity_id uuid,
  p_old jsonb, p_new jsonb, p_ip text, p_ua text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_org is null or p_org not in (select my_org_ids()) then return; end if;
  insert into audit_logs(org_id, branch_id, user_id, action, entity, entity_id, old_value, new_value, ip, user_agent)
  values (p_org, p_branch, auth.uid(), p_action, p_entity, p_entity_id, p_old, p_new, p_ip, p_ua);
end; $$;

grant execute on function public.log_audit(uuid,uuid,text,text,uuid,jsonb,jsonb,text,text) to authenticated;
