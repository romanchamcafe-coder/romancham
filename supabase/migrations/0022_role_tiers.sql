-- ============================================================
-- Romancham — map the 8 SaaS roles onto the legacy DB permission tiers.
-- Every RLS policy / RPC gate compares my_role() against the legacy names
-- ('owner','manager','accountant','staff'). New roles (kitchen, admin,
-- branch_manager, accounts, store, cashier) were therefore rejected by the
-- database ("forbidden") even when the app allowed the screen.
--
-- Tier mapping (what my_role() now returns):
--   owner, admin                     -> owner
--   manager, branch_manager, kitchen -> manager   (kitchen: purchases, vendors,
--                                                  production, stock — UI still
--                                                  hides Sales / P&L / Reports / AI / Settings)
--   accountant, accounts             -> accountant
--   staff, store, cashier            -> staff
--   viewer                           -> viewer    (read-only)
-- Team management still uses role_is_admin() on the RAW role, so kitchen
-- cannot manage members.
-- ============================================================
create or replace function public.my_role(p_org uuid)
returns role_t language sql stable security definer set search_path = public as $$
  select (case m.role::text
            when 'admin'          then 'owner'
            when 'branch_manager' then 'manager'
            when 'kitchen'        then 'manager'
            when 'accounts'       then 'accountant'
            when 'store'          then 'staff'
            when 'cashier'        then 'staff'
            else m.role::text
          end)::role_t
  from memberships m
  where m.user_id = auth.uid() and m.org_id = p_org and m.is_active
  limit 1;
$$;
