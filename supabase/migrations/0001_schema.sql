-- ============================================================
-- Brewmetrics — Phase 1 schema
-- ============================================================
create extension if not exists pgcrypto;

create type role_t       as enum ('owner','manager','staff','accountant');
create type pay_status_t as enum ('unpaid','partial','paid');
create type move_t       as enum ('opening','purchase','consumption','adjustment','transfer_in','transfer_out','wastage');
create type cat_type_t   as enum ('ingredient','menu','expense');
create type sale_src_t   as enum ('manual','pos_csv','api');

-- ---------- Tenancy & identity ----------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  gstin text,
  state_code text,
  currency text not null default 'INR',
  logo_path text,
  plan text default 'free',
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create table branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  code text,
  address text,
  gstin text,
  state_code text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_path text,
  created_at timestamptz default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role role_t not null default 'staff',
  is_active boolean default true,
  invited_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (org_id, user_id)
);

create table membership_branches (
  membership_id uuid not null references memberships(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  primary key (membership_id, branch_id)
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role role_t not null default 'staff',
  token text unique not null default encode(gen_random_bytes(16),'hex'),
  expires_at timestamptz default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- Master data ----------
create table units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  abbr text not null,
  base_unit_id uuid references units(id),
  factor_to_base numeric(14,6) not null default 1,
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  type cat_type_t not null,
  parent_id uuid references categories(id),
  created_at timestamptz default now()
);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  sku text,
  category_id uuid references categories(id),
  base_unit_id uuid references units(id),
  hsn_code text,
  default_gst_rate numeric(5,2) default 0,
  reorder_level numeric(14,4) default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  gstin text,
  state_code text,
  phone text,
  email text,
  address text,
  payment_terms_days int default 0,
  rating numeric(3,2),
  is_active boolean default true,
  created_at timestamptz default now()
);

create table vendor_ingredients (
  vendor_id uuid not null references vendors(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  last_price numeric(14,2),
  preferred boolean default false,
  primary key (vendor_id, ingredient_id)
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  sku text,
  category_id uuid references categories(id),
  selling_price numeric(14,2) not null default 0,
  gst_rate numeric(5,2) default 0,
  image_path text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  yield_qty numeric(14,4) not null default 1,
  yield_unit_id uuid references units(id),
  version int default 1,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  component_type text not null default 'ingredient', -- ingredient | menu_item
  ingredient_id uuid references ingredients(id),
  sub_menu_item_id uuid references menu_items(id),
  qty numeric(14,4) not null,
  unit_id uuid references units(id),
  wastage_pct numeric(5,2) default 0
);

-- ---------- Purchases ----------
create table purchases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  vendor_id uuid references vendors(id),
  bill_no text,
  bill_date date not null default current_date,
  due_date date,
  subtotal numeric(14,2) default 0,
  cgst numeric(14,2) default 0,
  sgst numeric(14,2) default 0,
  igst numeric(14,2) default 0,
  total numeric(14,2) default 0,
  payment_status pay_status_t default 'unpaid',
  amount_paid numeric(14,2) default 0,
  bill_file_path text,
  notes text,
  created_at timestamptz default now()
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  qty numeric(14,4) not null,
  unit_id uuid references units(id),
  rate numeric(14,4) not null,
  gst_rate numeric(5,2) default 0,
  cgst numeric(14,2) default 0,
  sgst numeric(14,2) default 0,
  igst numeric(14,2) default 0,
  hsn_code text,
  line_total numeric(14,2) default 0
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  purchase_id uuid not null references purchases(id) on delete cascade,
  amount numeric(14,2) not null,
  paid_on date default current_date,
  method text,
  reference text,
  created_at timestamptz default now()
);

-- ---------- Sales ----------
create table sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  sale_date date not null default current_date,
  source sale_src_t default 'manual',
  external_ref text,
  channel text,
  gross_amount numeric(14,2) default 0,
  discount numeric(14,2) default 0,
  tax_amount numeric(14,2) default 0,
  net_amount numeric(14,2) default 0,
  cogs numeric(14,2) default 0,
  created_at timestamptz default now()
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  qty numeric(14,4) not null,
  rate numeric(14,2) not null,
  discount numeric(14,2) default 0,
  gst_rate numeric(5,2) default 0,
  line_total numeric(14,2) default 0
);

create table pos_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  file_path text,
  status text default 'pending',
  rows_total int default 0,
  rows_ok int default 0,
  rows_error int default 0,
  error_log jsonb,
  mapping jsonb,
  created_at timestamptz default now()
);

-- ---------- Inventory (ledger + FIFO layers) ----------
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  movement_type move_t not null,
  qty numeric(14,4) not null,            -- signed, in ingredient base unit
  unit_cost numeric(14,4) default 0,
  source_table text,
  source_id uuid,
  occurred_at timestamptz default now()
);
create index on inventory_movements (org_id, branch_id, ingredient_id, occurred_at);

create table inventory_cost_layers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  received_at timestamptz default now(),
  qty_remaining numeric(14,4) not null,
  unit_cost numeric(14,4) not null,
  source_movement_id uuid references inventory_movements(id)
);
create index on inventory_cost_layers (org_id, branch_id, ingredient_id, received_at);

create table stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  reason text not null,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table stock_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  period date not null,
  ingredient_id uuid not null references ingredients(id),
  opening_qty numeric(14,4) default 0,
  in_qty numeric(14,4) default 0,
  consumed_qty numeric(14,4) default 0,
  adjust_qty numeric(14,4) default 0,
  closing_qty numeric(14,4) default 0,
  closing_value numeric(14,2) default 0
);

-- ---------- Expenses ----------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  category_id uuid references categories(id),
  expense_date date not null default current_date,
  amount numeric(14,2) not null,
  gst_amount numeric(14,2) default 0,
  vendor_name text,
  payment_method text,
  recurring boolean default false,
  receipt_path text,
  note text,
  created_at timestamptz default now()
);

-- ---------- System ----------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid references branches(id),
  type text not null,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references profiles(id),
  action text,
  entity text,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz default now()
);

-- ---------- Current-stock view ----------
create view v_current_stock as
  select org_id, branch_id, ingredient_id, sum(qty) as qty
  from inventory_movements
  group by org_id, branch_id, ingredient_id;
