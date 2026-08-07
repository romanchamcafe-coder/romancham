-- ============================================================
-- Romancham — Operations module (Phase 1): checklists + wastage
-- Additive. Branch-scoped, RLS-protected like existing tables.
-- ============================================================

-- Completed checklist instances. Item results stored as JSONB so the
-- checklist definitions can live in app code (no template management UI).
create table if not exists public.ops_checklist_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  checklist_type text not null,             -- opening | closing | cleaning_morning | cleaning_afternoon | cleaning_night | food_safety
  run_date date not null default current_date,
  items jsonb not null default '[]'::jsonb, -- [{ key, label, checked, critical, value }]
  total int not null default 0,
  done int not null default 0,
  score numeric(5,2) not null default 0,    -- compliance %
  notes text,
  performed_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists ops_checklist_runs_idx
  on public.ops_checklist_runs(org_id, branch_id, run_date, checklist_type);

-- Wastage log
create table if not exists public.ops_wastage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  occurred_on date not null default current_date,
  ingredient_id uuid references ingredients(id),
  item_name text not null,
  qty numeric(14,4) not null default 0,
  unit text,
  reason text not null,                     -- spoilage | overproduction | spillage | expiry | prep_error | returned | other
  cost numeric(14,2) not null default 0,
  note text,
  logged_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists ops_wastage_idx
  on public.ops_wastage(org_id, branch_id, occurred_on);

alter table public.ops_checklist_runs enable row level security;
alter table public.ops_wastage enable row level security;

-- Branch-scoped read; any active team member can perform/record.
do $$
declare t text;
begin
  for t in select unnest(array['ops_checklist_runs','ops_wastage']) loop
    execute format('drop policy if exists %1$s_read on public.%1$I;', t);
    execute format('create policy %1$s_read on public.%1$I for select using (org_id in (select my_org_ids()) and branch_id in (select my_branch_ids(org_id)));', t);
    execute format('drop policy if exists %1$s_write on public.%1$I;', t);
    execute format('create policy %1$s_write on public.%1$I for all using (org_id in (select my_org_ids()) and my_role(org_id) in (''owner'',''manager'',''accountant'',''staff'')) with check (org_id in (select my_org_ids()));', t);
  end loop;
end $$;
