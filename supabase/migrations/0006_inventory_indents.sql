-- ============================================================
-- Romancham — Operations Phase 2: indents + purchase requests
-- Adds min/max levels, vendor tiers, and two request workflows.
-- Additive, branch-scoped, RLS-protected.
-- ============================================================

-- Max stock level (reorder_level already serves as the min)
alter table public.ingredients add column if not exists max_level numeric(14,4) default 0;

-- Vendor tier per item: primary | secondary | emergency
alter table public.vendor_ingredients add column if not exists tier text default 'primary';

-- Internal stock request (kitchen/store -> store/manager)
create table if not exists public.ops_indents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  status text not null default 'pending',   -- pending | approved | fulfilled | rejected
  items jsonb not null default '[]'::jsonb,  -- [{ ingredient_id, name, unit, qty }]
  note text,
  requested_by uuid references profiles(id),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists ops_indents_idx on public.ops_indents(org_id, branch_id, status, created_at desc);

-- Purchase request (to buy from a vendor)
create table if not exists public.ops_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  status text not null default 'pending',    -- pending | approved | ordered | received | rejected
  vendor_id uuid references vendors(id),
  items jsonb not null default '[]'::jsonb,   -- [{ ingredient_id, name, unit, qty, est_cost }]
  note text,
  requested_by uuid references profiles(id),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists ops_pr_idx on public.ops_purchase_requests(org_id, branch_id, status, created_at desc);

alter table public.ops_indents enable row level security;
alter table public.ops_purchase_requests enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['ops_indents','ops_purchase_requests']) loop
    execute format('drop policy if exists %1$s_read on public.%1$I;', t);
    execute format('create policy %1$s_read on public.%1$I for select using (org_id in (select my_org_ids()) and branch_id in (select my_branch_ids(org_id)));', t);
    execute format('drop policy if exists %1$s_write on public.%1$I;', t);
    execute format('create policy %1$s_write on public.%1$I for all using (org_id in (select my_org_ids()) and my_role(org_id) in (''owner'',''manager'',''accountant'',''staff'')) with check (org_id in (select my_org_ids()));', t);
  end loop;
end $$;
