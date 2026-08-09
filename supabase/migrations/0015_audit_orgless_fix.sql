-- ============================================================
-- Fix: saving a Purchase failed with
--   "null value in column org_id of relation audit_logs".
--
-- Cause: the generic audit trigger (0009) is attached to vendor_ingredients,
-- but that table has no org_id (and no id) column — its PK is (vendor_id,
-- ingredient_id). post_purchase upserts vendor_ingredients to remember the
-- vendor's last price, the audit trigger fires, derives org_id = NULL, and the
-- INSERT into audit_logs violates the NOT NULL constraint — rolling back the
-- entire purchase transaction.
--
-- Two-part fix:
--   1) Make audit_row() resilient: if it cannot determine the org for a row,
--      skip the audit insert instead of aborting the business transaction.
--   2) Stop auditing vendor_ingredients (derivative pricing data; the parent
--      purchase row is already audited).
-- ============================================================

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

  -- Never let auditing break a business transaction: if we can't resolve the
  -- org for this row, skip the audit entry.
  if v_org is null then return coalesce(NEW, OLD); end if;

  insert into audit_logs(org_id, branch_id, user_id, action, entity, entity_id, old_value, new_value, ip, user_agent)
  values (v_org, v_branch, auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_id, j_old, j_new,
          nullif(current_setting('app.client_ip', true), ''),
          nullif(current_setting('app.client_ua', true), ''));
  return coalesce(NEW, OLD);
end; $$;

-- vendor_ingredients has no org scoping — remove it from automatic auditing.
drop trigger if exists trg_audit on public.vendor_ingredients;
