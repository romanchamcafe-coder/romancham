-- ============================================================
-- Romancham — stop invited staff from ending up as OWNER of a stray,
-- empty workspace (where every menu incl. Sales/P&L is visible).
--
-- 1) retire_solo_orgs(uid): once a user belongs to a real team, switch off
--    any workspace where they are the only member AND that has no sales and
--    no purchases (i.e. an empty one created by mistake at sign-up).
-- 2) accept_invitation: calls retire_solo_orgs after joining.
-- 3) bootstrap_org: if the signing-up email has a pending invitation, JOIN
--    that team (with the invited role) instead of creating a new workspace.
-- ============================================================

create or replace function public.retire_solo_orgs(p_uid uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update memberships m set is_active = false, status = 'removed'
  where m.user_id = p_uid and m.is_active and m.role::text = 'owner'
    and not exists (select 1 from memberships o where o.org_id = m.org_id and o.user_id <> p_uid and o.is_active)
    and not exists (select 1 from sales s where s.org_id = m.org_id)
    and not exists (select 1 from purchases p where p.org_id = m.org_id)
    and exists (select 1 from memberships k where k.user_id = p_uid and k.is_active and k.org_id <> m.org_id
                  and exists (select 1 from memberships o2 where o2.org_id = k.org_id and o2.user_id <> p_uid and o2.is_active));
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.retire_solo_orgs(uuid) from public, anon, authenticated;

create or replace function public.accept_invitation(p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare inv invitations%rowtype; uid uuid; uemail text; mid uuid; b uuid;
begin
  uid := auth.uid();
  if uid is null then return 'not_authenticated'; end if;
  uemail := lower(coalesce((auth.jwt() ->> 'email'), ''));

  select * into inv from invitations where token = p_token;
  if not found then return 'invalid'; end if;
  if inv.status <> 'pending' then return 'not_pending'; end if;
  if inv.expires_at < now() then
    update invitations set status = 'expired' where id = inv.id;
    return 'expired';
  end if;
  if lower(inv.email) <> uemail then return 'email_mismatch'; end if;

  insert into memberships (org_id, user_id, role, is_active, status, invited_by)
  values (inv.org_id, uid, inv.role, true, 'active', inv.invited_by)
  on conflict (org_id, user_id)
  do update set role = excluded.role, is_active = true, status = 'active'
  returning id into mid;

  foreach b in array coalesce(inv.branch_ids, '{}')
  loop
    insert into membership_branches (membership_id, branch_id)
    values (mid, b) on conflict do nothing;
  end loop;

  update invitations set status = 'accepted', accepted_at = now() where id = inv.id;
  perform public.retire_solo_orgs(uid);
  return 'ok';
end; $$;
grant execute on function public.accept_invitation(text) to authenticated;

create or replace function public.bootstrap_org(p_name text, p_slug text, p_branch text default 'Main Branch', p_state text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_branch uuid; v_mem uuid; v_inv invitations%rowtype; v_email text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  -- Invited email? Join that team instead of creating a new workspace.
  v_email := lower(coalesce((auth.jwt() ->> 'email'), ''));
  select * into v_inv from invitations
   where lower(email) = v_email and status = 'pending' and expires_at > now()
   order by created_at desc limit 1;
  if found then
    if public.accept_invitation(v_inv.token) = 'ok' then return v_inv.org_id; end if;
  end if;

  insert into organizations(name, slug, state_code) values (p_name, p_slug, p_state) returning id into v_org;
  insert into branches(org_id, name, state_code) values (v_org, p_branch, p_state) returning id into v_branch;
  insert into memberships(org_id, user_id, role) values (v_org, auth.uid(), 'owner') returning id into v_mem;
  insert into membership_branches(membership_id, branch_id) values (v_mem, v_branch);
  return v_org;
end; $$;
