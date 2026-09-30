-- ============================================================
-- Romancham — Staff attendance & salary
--   staff             : people (names visible to everyone in the branch)
--   staff_pay         : monthly salary + OT rate   (money — managers only)
--   staff_attendance  : one row per staff per day (status, in/out, OT hours)
--   staff_advances    : salary advances           (money — managers only)
-- Kitchen can mark attendance and edit names, but CANNOT read salaries or
-- advances: those tables check the RAW role (kitchen maps to "manager" in
-- my_role(), so we must not use my_role() here).
-- ============================================================

create or replace function public.can_see_pay(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('owner','admin','branch_manager','manager','accountant','accounts')
    from memberships where user_id = auth.uid() and org_id = p_org and is_active limit 1), false);
$$;
grant execute on function public.can_see_pay(uuid) to authenticated;

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  designation text,
  phone text,
  joined_on date,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists staff_org_branch_idx on public.staff(org_id, branch_id, is_active);

create table if not exists public.staff_pay (
  staff_id uuid primary key references public.staff(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  monthly_salary numeric(12,2) not null default 0,
  ot_rate_per_hour numeric(10,2),          -- null = auto (salary ÷ days in month ÷ 8)
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  att_date date not null,
  status text not null check (status in ('present','absent','half_day','week_off','leave')),
  in_time time,
  out_time time,
  ot_hours numeric(5,2) not null default 0,
  note text,
  marked_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (staff_id, att_date)
);
create index if not exists staff_att_org_date_idx on public.staff_attendance(org_id, branch_id, att_date);

create table if not exists public.staff_advances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  adv_date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists staff_adv_org_date_idx on public.staff_advances(org_id, adv_date);

alter table public.staff enable row level security;
alter table public.staff_pay enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.staff_advances enable row level security;

-- staff + attendance: any member of the branch can read and write.
drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select
  using (org_id in (select my_org_ids()) and branch_id in (select my_branch_ids(org_id)));
drop policy if exists staff_write on public.staff;
create policy staff_write on public.staff for all
  using (org_id in (select my_org_ids()) and my_role(org_id) in ('owner','manager','accountant','staff'))
  with check (org_id in (select my_org_ids()) and branch_id in (select my_branch_ids(org_id)));

drop policy if exists staff_att_read on public.staff_attendance;
create policy staff_att_read on public.staff_attendance for select
  using (org_id in (select my_org_ids()) and branch_id in (select my_branch_ids(org_id)));
drop policy if exists staff_att_write on public.staff_attendance;
create policy staff_att_write on public.staff_attendance for all
  using (org_id in (select my_org_ids()) and my_role(org_id) in ('owner','manager','accountant','staff'))
  with check (org_id in (select my_org_ids()) and branch_id in (select my_branch_ids(org_id)));

-- money tables: pay-visible roles only (read AND write).
drop policy if exists staff_pay_rw on public.staff_pay;
create policy staff_pay_rw on public.staff_pay for all
  using (public.can_see_pay(org_id)) with check (public.can_see_pay(org_id));
drop policy if exists staff_adv_rw on public.staff_advances;
create policy staff_adv_rw on public.staff_advances for all
  using (public.can_see_pay(org_id)) with check (public.can_see_pay(org_id));

-- ---------- Seed: Staff 1 … Staff 15 for Romancham Cafe (only if none exist yet) ----------
insert into public.staff (org_id, branch_id, name, sort_order)
select 'cf2dbc8f-9d4b-4c37-b408-81b0defd82da',
       (select id from public.branches where org_id = 'cf2dbc8f-9d4b-4c37-b408-81b0defd82da' and is_active order by created_at limit 1),
       'Staff ' || g, g
from generate_series(1, 15) g
where not exists (select 1 from public.staff where org_id = 'cf2dbc8f-9d4b-4c37-b408-81b0defd82da');

-- Check: expect 15 rows
select name, sort_order from public.staff where org_id = 'cf2dbc8f-9d4b-4c37-b408-81b0defd82da' order by sort_order;
