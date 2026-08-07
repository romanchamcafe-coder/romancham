-- ============================================================
-- Romancham — Phase 1: Team Management
-- Additive & backward-compatible. Expands roles, adds member status,
-- last-login tracking, and a full invitation lifecycle.
-- ============================================================

-- 1) Expand the role enum (additive — legacy values kept for compatibility).
alter type role_t add value if not exists 'admin';
alter type role_t add value if not exists 'branch_manager';
alter type role_t add value if not exists 'kitchen';
alter type role_t add value if not exists 'store';
alter type role_t add value if not exists 'cashier';
alter type role_t add value if not exists 'accounts';
alter type role_t add value if not exists 'viewer';

-- 2) Membership status + last login.
alter table memberships add column if not exists status text not null default 'active'
  check (status in ('active','suspended','removed'));
alter table memberships add column if not exists last_login_at timestamptz;

-- 3) Invitation lifecycle columns.
alter table invitations add column if not exists status text not null default 'pending'
  check (status in ('pending','accepted','cancelled','expired'));
alter table invitations add column if not exists invited_by uuid references profiles(id);
alter table invitations add column if not exists branch_ids uuid[] not null default '{}';
alter table invitations add column if not exists resent_at timestamptz;
create index if not exists invitations_org_status_idx on invitations(org_id, status);

-- 4) Role tiers (text-compared so new enum values need no cast at policy-creation).
--    admin tier  = full org control (owner, admin)
--    manager tier = day-to-day + all branches (manager, branch_manager)
--    finance tier = accountant, accounts
create or replace function public.role_is_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('owner','admin')
    from memberships where user_id = auth.uid() and org_id = p_org and is_active limit 1), false);
$$;

-- All-branch visibility for admin/manager/finance tiers; others limited to assigned branches.
create or replace function public.my_branch_ids(p_org uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select b.id from branches b where b.org_id = p_org and (
    (select role::text from memberships where user_id = auth.uid() and org_id = p_org and is_active limit 1)
      in ('owner','admin','manager','branch_manager','accountant','accounts')
    or b.id in (
      select mb.branch_id from membership_branches mb
      join memberships m on m.id = mb.membership_id
      where m.user_id = auth.uid() and m.org_id = p_org and m.is_active
    )
  );
$$;

-- 5) Owners AND admins manage the team.
drop policy if exists mem_write on memberships;
create policy mem_write on memberships for all
  using (public.role_is_admin(org_id)) with check (public.role_is_admin(org_id));

drop policy if exists memb_branch_write on membership_branches;
create policy memb_branch_write on membership_branches for all using (
  membership_id in (select id from memberships m where public.role_is_admin(m.org_id)));

drop policy if exists inv_rw on invitations;
create policy inv_rw on invitations for all
  using (public.role_is_admin(org_id)) with check (public.role_is_admin(org_id));

-- 6) Invitation RPCs (SECURITY DEFINER; token-scoped, email-verified).

-- Public-ish read: anyone holding the token can see who/what the invite is for.
create or replace function public.get_invitation(p_token text)
returns table(org_name text, email text, role role_t, status text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.name, i.email, i.role, i.status, i.expires_at
  from invitations i join organizations o on o.id = i.org_id
  where i.token = p_token;
$$;

-- Accept: the signed-in user (whose email matches the invite) joins the org.
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
  return 'ok';
end; $$;

-- Record last login for the current user across their memberships.
create or replace function public.touch_last_login()
returns void language sql security definer set search_path = public as $$
  update memberships set last_login_at = now() where user_id = auth.uid();
$$;

grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.touch_last_login() to authenticated;
