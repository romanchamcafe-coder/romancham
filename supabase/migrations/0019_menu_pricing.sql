-- ============================================================
-- Menu Engineering: per Sales-item pricing model.
-- Recipe cost is derived live from the recipe; this table stores the extra
-- cost/markup inputs and the derived dine-in / takeaway / delivery prices so
-- they persist and can feed reports.
-- ============================================================

create table if not exists menu_pricing (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  sales_item_id uuid not null references ingredients(id) on delete cascade,
  packaging_cost    numeric(14,2) default 0,   -- cup, lid, sleeve, straw, box, tissue…
  wastage_pct       numeric(6,2)  default 0,   -- expected prep loss %
  labor_cost        numeric(14,2) default 0,   -- barista / kitchen labour per unit
  utility_cost      numeric(14,2) default 0,   -- electricity, water, gas, internet
  overhead_cost     numeric(14,2) default 0,   -- rent, maintenance, software, cleaning, admin
  marketing_cost    numeric(14,2) default 0,   -- social, ads, promotions
  commission_pct    numeric(6,2)  default 0,   -- Swiggy/Zomato/payment gateway (delivery)
  target_profit_pct numeric(6,2)  default 0,   -- desired profit % on cost
  gst_pct           numeric(6,2)  default 0,   -- applicable tax
  dine_price        numeric(14,2) default 0,
  takeaway_price    numeric(14,2) default 0,
  delivery_price    numeric(14,2) default 0,
  updated_at timestamptz default now(),
  unique (org_id, sales_item_id)
);

alter table menu_pricing enable row level security;

create policy menu_pricing_read on public.menu_pricing
  for select using (org_id in (select my_org_ids()));
create policy menu_pricing_write on public.menu_pricing
  for all using (my_role(org_id) in ('owner','manager','accountant'))
  with check (my_role(org_id) in ('owner','manager','accountant'));

grant select, insert, update, delete on public.menu_pricing to authenticated;
