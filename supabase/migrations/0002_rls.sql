-- ============================================================
-- Brewmetrics — Auth trigger + Row-Level Security
-- ============================================================

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: orgs the current user belongs to
create or replace function public.my_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from memberships where user_id = auth.uid() and is_active;
$$;

-- Helper: current user's role in an org
create or replace function public.my_role(p_org uuid)
returns role_t language sql stable security definer set search_path = public as $$
  select role from memberships where user_id = auth.uid() and org_id = p_org and is_active limit 1;
$$;

-- Helper: branches the current user can access in an org
create or replace function public.my_branch_ids(p_org uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select b.id from branches b where b.org_id = p_org and (
    public.my_role(p_org) in ('owner','manager','accountant')
    or b.id in (
      select mb.branch_id from membership_branches mb
      join memberships m on m.id = mb.membership_id
      where m.user_id = auth.uid() and m.org_id = p_org
    )
  );
$$;

-- Enable RLS everywhere
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname='public'
    and tablename in ('organizations','branches','profiles','memberships','membership_branches','invitations',
      'units','categories','ingredients','vendors','vendor_ingredients','menu_items','recipes','recipe_items',
      'purchases','purchase_items','payments','sales','sale_items','pos_imports','inventory_movements',
      'inventory_cost_layers','stock_adjustments','stock_snapshots','expenses','notifications','audit_logs')
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- Profiles: a user sees/edits only their own profile
create policy p_profile_self on profiles for all using (id = auth.uid()) with check (id = auth.uid());

-- Organizations
create policy org_read  on organizations for select using (id in (select my_org_ids()));
create policy org_write on organizations for update using (my_role(id) = 'owner') with check (my_role(id) = 'owner');
create policy org_insert on organizations for insert with check (true); -- created via bootstrap RPC

-- Memberships: a user can see memberships of their orgs; owners manage them
create policy mem_read  on memberships for select using (org_id in (select my_org_ids()));
create policy mem_write on memberships for all using (my_role(org_id) = 'owner') with check (my_role(org_id) = 'owner');

create policy memb_branch_read on membership_branches for select using (
  membership_id in (select id from memberships where org_id in (select my_org_ids())));
create policy memb_branch_write on membership_branches for all using (
  membership_id in (select id from memberships m where my_role(m.org_id) = 'owner'));

-- Branches
create policy branch_read  on branches for select using (org_id in (select my_org_ids()));
create policy branch_write on branches for all using (my_role(org_id) in ('owner','manager'))
  with check (my_role(org_id) in ('owner','manager'));

-- Invitations
create policy inv_rw on invitations for all using (my_role(org_id) = 'owner') with check (my_role(org_id) = 'owner');

-- Generic org-scoped tables (read = member; write = owner/manager) ----
-- Each policy is created in its own EXECUTE for cross-version safety.
do $$
declare t text; org_expr text;
begin
  for t in select unnest(array['units','categories','ingredients','vendors','vendor_ingredients',
                               'menu_items','recipes','recipe_items'])
  loop
    org_expr := case t
      when 'vendor_ingredients' then '(select org_id from vendors v where v.id = vendor_id)'
      when 'recipe_items'       then '(select org_id from recipes r where r.id = recipe_id)'
      else 'org_id' end;
    execute format('create policy %1$s_read on public.%1$I for select using (%2$s in (select my_org_ids()));', t, org_expr);
    execute format('create policy %1$s_write on public.%1$I for all using (my_role(%2$s) in (''owner'',''manager'')) with check (my_role(%2$s) in (''owner'',''manager''));', t, org_expr);
  end loop;
end $$;

-- Branch-scoped transactional tables (read = branch access; write = role-gated)
do $$
declare t text;
begin
  for t in select unnest(array['purchases','sales','expenses','inventory_movements',
                               'inventory_cost_layers','stock_adjustments','stock_snapshots','pos_imports','notifications'])
  loop
    execute format('create policy %1$s_read on public.%1$I for select using (org_id in (select my_org_ids()) and branch_id in (select my_branch_ids(org_id)));', t);
    execute format('create policy %1$s_write on public.%1$I for all using (org_id in (select my_org_ids()) and my_role(org_id) in (''owner'',''manager'',''accountant'',''staff'')) with check (org_id in (select my_org_ids()));', t);
  end loop;
end $$;

-- Child tables of purchases/sales (inherit access via parent)
create policy pi_rw on purchase_items for all using (
  purchase_id in (select id from purchases)) with check (purchase_id in (select id from purchases));
create policy si_rw on sale_items for all using (
  sale_id in (select id from sales)) with check (sale_id in (select id from sales));
create policy pay_rw on payments for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy audit_read on audit_logs for select using (org_id in (select my_org_ids()));
