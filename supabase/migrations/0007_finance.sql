-- ============================================================
-- Romancham — Operations Phase 3 (Finance): daily cash reconciliation
-- Additive, branch-scoped, RLS-protected.
-- ============================================================

create table if not exists public.ops_cash_recon (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  recon_date date not null default current_date,
  opening_float numeric(14,2) not null default 0,
  cash_sales numeric(14,2) not null default 0,   -- expected cash from POS (auto)
  cash_out numeric(14,2) not null default 0,      -- petty cash paid out
  expected numeric(14,2) not null default 0,      -- float + cash_sales - cash_out
  counted numeric(14,2) not null default 0,       -- physically counted
  variance numeric(14,2) not null default 0,      -- counted - expected
  note text,
  done_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists ops_cash_recon_idx on public.ops_cash_recon(org_id, branch_id, recon_date desc);

alter table public.ops_cash_recon enable row level security;

drop policy if exists ops_cash_recon_read on public.ops_cash_recon;
create policy ops_cash_recon_read on public.ops_cash_recon for select
  using (org_id in (select my_org_ids()) and branch_id in (select my_branch_ids(org_id)));
drop policy if exists ops_cash_recon_write on public.ops_cash_recon;
create policy ops_cash_recon_write on public.ops_cash_recon for all
  using (org_id in (select my_org_ids()) and my_role(org_id) in ('owner','manager','accountant','staff'))
  with check (org_id in (select my_org_ids()));
