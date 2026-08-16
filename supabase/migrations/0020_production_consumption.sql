-- ============================================================
-- Romancham — Production & Consumption module (Phase 1: schema)
-- ============================================================
-- Adds an immutable, batch- and location-aware stock ledger for
-- BATCH_PRODUCED finished goods, following the physical flow:
--
--     PRODUCTION -> STORE -> DISPLAY -> SOLD
--                                \-> WASTAGE
--
-- Design decisions (confirmed with owner):
--   * Scope        : finished goods + locations only. Raw-material stock
--                    stays in the existing inventory_movements ledger;
--                    reports UNION the two. No data migration here.
--   * Locations    : fixed enum (store, display) per branch.
--   * Product type : reuse ingredients.fulfillment
--                       'direct' = MADE_TO_ORDER  (backflush on sale)
--                       'stock'  = BATCH_PRODUCED (produced, transferred, sold)
--
-- Principles:
--   * The ledger is APPEND-ONLY. Current stock is always derived by
--     summing ledger rows — never stored/edited directly.
--   * Every physical action (produce, transfer, sell, waste, count
--     adjustment, reversal) writes one or more stock_ledger rows.
--   * Corrections are made by posting a 'reversal' row that points at
--     the original via reversal_ref — originals are never mutated.
--
-- Idempotent: safe to run more than once.
-- ============================================================

-- ---------- Enums ----------
do $$ begin
  create type stock_location_t as enum ('store','display');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_item_kind_t as enum ('raw','finished');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_txn_t as enum (
    'purchase',                -- raw received (reserved for future unification)
    'production_consumption',  -- raw consumed by a production batch (signed -)
    'production_output',       -- finished units produced into Store (signed +)
    'transfer',                -- Store <-> Display (two rows: out - / in +)
    'sale',                    -- finished units sold from Display (signed -)
    'wastage',                 -- finished units written off (signed -)
    'adjustment',              -- physical-count reconciliation (signed +/-)
    'reversal'                 -- cancels a prior row (signed opposite)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type batch_status_t as enum ('active','depleted','expired','discarded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wastage_reason_t as enum (
    'expired','over_portioned','staff_meal','complimentary',
    'damaged','trial_batch','customer_return','quality_rejection'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type count_status_t as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type period_status_t as enum ('open','closed');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 1. production_batch
--    One physical batch of a BATCH_PRODUCED sales item.
--    Raw consumption + finished output are posted to stock_ledger
--    (in Phase 2); this row is the batch's cost & yield header.
-- ============================================================
create table if not exists public.production_batch (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  branch_id          uuid not null references branches(id) on delete cascade,
  batch_code         text not null,                       -- e.g. CHS-20260816-01
  sales_item_id      uuid not null references ingredients(id),  -- the finished good
  recipe_version     int,                                 -- item_recipe version snapshot
  production_date    date not null default current_date,
  planned_qty        numeric(14,4) not null default 0,    -- sellable units planned
  actual_yield       numeric(14,4) not null default 0,    -- sellable units produced
  expected_portions  numeric(14,4),                       -- planned_qty * portions/unit
  actual_portions    numeric(14,4),
  raw_material_cost  numeric(14,2) not null default 0,    -- total raw consumed value
  cost_per_stock_unit numeric(14,4) not null default 0,   -- raw_material_cost / actual_yield
  cost_per_portion   numeric(14,4) not null default 0,
  expiry_date        date,
  status             batch_status_t not null default 'active',
  note               text,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  unique (org_id, batch_code)
);
create index if not exists production_batch_lookup_idx
  on public.production_batch (org_id, branch_id, sales_item_id, production_date);
create index if not exists production_batch_expiry_idx
  on public.production_batch (org_id, branch_id, expiry_date)
  where status = 'active';

-- ============================================================
-- 2. stock_ledger  (immutable, append-only)
--    The single source of truth for finished-goods stock by
--    location and batch. Current stock = SUM(qty) over rows.
-- ============================================================
create table if not exists public.stock_ledger (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  branch_id      uuid not null references branches(id) on delete cascade,
  txn_date       timestamptz not null default now(),
  txn_type       stock_txn_t not null,
  item_kind      stock_item_kind_t not null default 'finished',
  item_id        uuid not null references ingredients(id),   -- finished good (or raw, future)
  batch_id       uuid references production_batch(id),       -- FIFO layer for finished goods
  location       stock_location_t,                           -- null for non-located raw txns
  qty            numeric(14,4) not null,                     -- SIGNED, in item base unit
  uom_id         uuid references units(id),
  unit_cost      numeric(14,4) not null default 0,
  total_value    numeric(14,2) not null default 0,           -- qty * unit_cost (signed)
  ref_table      text,                                       -- source doc table
  ref_id         uuid,                                       -- source doc id
  reversal_ref   uuid references stock_ledger(id),           -- set on 'reversal' rows
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now()
);
create index if not exists stock_ledger_onhand_idx
  on public.stock_ledger (org_id, branch_id, item_id, location, batch_id);
create index if not exists stock_ledger_date_idx
  on public.stock_ledger (org_id, branch_id, txn_date);
create index if not exists stock_ledger_type_idx
  on public.stock_ledger (org_id, branch_id, txn_type, txn_date);

-- ============================================================
-- 3. stock_transfer  (Store -> Display; FIFO allocated in Phase 2)
--    Header row; the actual stock movement is two stock_ledger
--    rows (transfer out of `from`, transfer in to `to`).
-- ============================================================
create table if not exists public.stock_transfer (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  branch_id      uuid not null references branches(id) on delete cascade,
  transfer_date  date not null default current_date,
  from_location  stock_location_t not null default 'store',
  to_location    stock_location_t not null default 'display',
  sales_item_id  uuid not null references ingredients(id),
  batch_id       uuid references production_batch(id),   -- resolved by FIFO if null
  qty            numeric(14,4) not null,
  uom_id         uuid references units(id),
  note           text,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  check (from_location <> to_location)
);
create index if not exists stock_transfer_lookup_idx
  on public.stock_transfer (org_id, branch_id, transfer_date, sales_item_id);

-- ============================================================
-- 4. wastage_entry
-- ============================================================
create table if not exists public.wastage_entry (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  branch_id      uuid not null references branches(id) on delete cascade,
  wastage_date   date not null default current_date,
  sales_item_id  uuid not null references ingredients(id),
  batch_id       uuid references production_batch(id),   -- FIFO if null
  location       stock_location_t not null default 'display',
  qty            numeric(14,4) not null,
  uom_id         uuid references units(id),
  reason         wastage_reason_t not null,
  value_lost     numeric(14,2) not null default 0,       -- qty * batch cost_per_stock_unit
  notes          text,
  recorded_by    uuid references profiles(id),
  created_at     timestamptz not null default now()
);
create index if not exists wastage_entry_lookup_idx
  on public.wastage_entry (org_id, branch_id, wastage_date, sales_item_id);

-- ============================================================
-- 5. physical_count  (blind count -> variance revealed on submit)
-- ============================================================
create table if not exists public.physical_count (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  branch_id        uuid not null references branches(id) on delete cascade,
  count_date       date not null default current_date,
  location         stock_location_t not null default 'display',
  sales_item_id    uuid not null references ingredients(id),
  system_qty       numeric(14,4) not null default 0,     -- snapshot at submit time
  counted_qty      numeric(14,4) not null default 0,
  variance_qty     numeric(14,4) not null default 0,     -- counted - system
  variance_pct     numeric(9,4)  not null default 0,
  variance_value   numeric(14,2) not null default 0,
  uom_id           uuid references units(id),
  explanation      text,
  approval_status  count_status_t not null default 'pending',
  approved_by      uuid references profiles(id),
  counted_by       uuid references profiles(id),
  created_at       timestamptz not null default now()
);
create index if not exists physical_count_lookup_idx
  on public.physical_count (org_id, branch_id, count_date, location);

-- ============================================================
-- 6. consumption_period  (day-close lock; one row per business date/branch)
-- ============================================================
create table if not exists public.consumption_period (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  branch_id      uuid not null references branches(id) on delete cascade,
  business_date  date not null,
  status         period_status_t not null default 'open',
  closed_by      uuid references profiles(id),
  closed_at      timestamptz,
  created_at     timestamptz not null default now(),
  unique (org_id, branch_id, business_date)
);
create index if not exists consumption_period_lookup_idx
  on public.consumption_period (org_id, branch_id, business_date);

-- ============================================================
-- 7. Derived current-stock view (finished goods, by location & batch)
--    Current stock is ALWAYS computed here — never stored.
-- ============================================================
create or replace view public.v_finished_stock as
  select
    org_id, branch_id, item_id, location, batch_id,
    sum(qty)         as qty_on_hand,
    sum(total_value) as value_on_hand
  from public.stock_ledger
  where item_kind = 'finished'
  group by org_id, branch_id, item_id, location, batch_id;

-- ============================================================
-- 8. Row-Level Security
--    Read : any member of the org with access to the branch.
--    Write: owner / manager / accountant / staff (operational roles).
--    The ledger itself is insert-only for clients; corrections are
--    posted as reversal rows (enforced in Phase 2 RPCs).
-- ============================================================
do $$
declare t text;
begin
  for t in select unnest(array[
      'production_batch','stock_ledger','stock_transfer',
      'wastage_entry','physical_count','consumption_period'])
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

do $$
declare t text;
begin
  for t in select unnest(array[
      'production_batch','stock_ledger','stock_transfer',
      'wastage_entry','physical_count','consumption_period'])
  loop
    execute format('drop policy if exists %I_read on public.%I;', t, t);
    execute format($f$
      create policy %I_read on public.%I for select
        using (org_id in (select my_org_ids())
               and branch_id in (select my_branch_ids(org_id)));
    $f$, t, t);

    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format($f$
      create policy %I_write on public.%I for all
        using (org_id in (select my_org_ids())
               and my_role(org_id) in ('owner','manager','accountant','staff'))
        with check (org_id in (select my_org_ids())
               and branch_id in (select my_branch_ids(org_id)));
    $f$, t, t);
  end loop;
end $$;

grant select, insert, update, delete on
  public.production_batch, public.stock_transfer, public.wastage_entry,
  public.physical_count, public.consumption_period
  to authenticated;

-- stock_ledger: clients may read + insert only (append-only ledger).
grant select, insert on public.stock_ledger to authenticated;
grant select on public.v_finished_stock to authenticated;

-- ============================================================
-- End of Phase 1 schema. Ledger/FIFO RPCs + unit tests land in Phase 2.
-- ============================================================
