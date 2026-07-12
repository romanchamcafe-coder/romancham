-- ============================================================
-- Romancham — Finished goods & make-to-order backflush
-- ============================================================
-- Two fulfillment models for Sales items:
--   'direct' = made to order (coffee, juice) -> raw materials backflushed on sale
--   'stock'  = made to stock (ice cream)     -> produced in batches (consumes raw,
--                                               adds finished-goods stock); sale
--                                               deducts finished stock only.
-- Idempotent: safe to run more than once.

-- 1. Fulfillment flag on sales items ---------------------------------
alter table public.ingredients
  add column if not exists fulfillment text not null default 'direct';

-- 2. Productions (finished-good batches) -----------------------------
create table if not exists public.productions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  sales_item_id uuid not null references ingredients(id),
  qty numeric(14,4) not null,          -- sellable units produced
  produced_on date not null default current_date,
  note text,
  created_at timestamptz default now()
);
create index if not exists productions_org_branch_date_idx
  on public.productions(org_id, branch_id, produced_on);

alter table public.productions enable row level security;

drop policy if exists productions_read on public.productions;
create policy productions_read on public.productions for select
  using (org_id in (select my_org_ids()) and branch_id in (select my_branch_ids(org_id)));

drop policy if exists productions_write on public.productions;
create policy productions_write on public.productions for all
  using (org_id in (select my_org_ids()) and my_role(org_id) in ('owner','manager','accountant','staff'))
  with check (org_id in (select my_org_ids()));

-- 3. post_production: consume raw via recipe + add finished stock -----
create or replace function public.post_production(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid := (p->>'org_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_item   uuid := (p->>'sales_item_id')::uuid;
  v_qty    numeric := (p->>'qty')::numeric;
  v_on     date := coalesce((p->>'produced_on')::date, current_date);
  v_prod   uuid;
  ri       record;
begin
  if my_role(v_org) not in ('owner','manager','accountant','staff') then
    raise exception 'forbidden';
  end if;
  if v_qty is null or v_qty <= 0 then
    raise exception 'qty must be greater than 0';
  end if;

  insert into productions(org_id, branch_id, sales_item_id, qty, produced_on, note)
  values (v_org, v_branch, v_item, v_qty, v_on, nullif(btrim(p->>'note'), ''))
  returning id into v_prod;

  -- consume each raw component (item_recipe.qty is per 1 sellable unit)
  for ri in
    select component_id, qty from item_recipe
     where org_id = v_org and sales_item_id = v_item
  loop
    insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, source_table, source_id, occurred_at)
    values (v_org, v_branch, ri.component_id, 'consumption', -1 * v_qty * ri.qty, 'productions', v_prod, v_on::timestamptz);
  end loop;

  -- add finished-good stock (movement_type 'adjustment', tagged by source_table)
  insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, source_table, source_id, occurred_at)
  values (v_org, v_branch, v_item, 'adjustment', v_qty, 'productions', v_prod, v_on::timestamptz);

  return v_prod;
end; $$;

-- 4. sync_sales_consumption: idempotent backflush from pos_sales ------
--    Rebuilds all sales-sourced consumption for a branch within a date
--    range, so it is safe to run automatically on every import AND
--    manually on demand without ever double-counting.
create or replace function public.sync_sales_consumption(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid := (p->>'org_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_from   date := coalesce((p->>'from')::date, date '1900-01-01');
  v_to     date := coalesce((p->>'to')::date, date '2999-12-31');
  s        record;
  ri       record;
  v_ing_id uuid;
  v_ful    text;
  v_matched   int := 0;
  v_unmatched text[] := '{}';
begin
  if my_role(v_org) not in ('owner','manager','accountant','staff') then
    raise exception 'forbidden';
  end if;

  -- wipe prior sales-sourced consumption in range (makes this idempotent)
  delete from inventory_movements
   where org_id = v_org and branch_id = v_branch
     and source_table = 'pos_sales'
     and occurred_at::date between v_from and v_to;

  for s in
    select lower(btrim(item_name)) as key,
           min(item_name)          as item_name,
           sale_date,
           sum(coalesce(qty, 0))   as qty
      from pos_sales
     where org_id = v_org and branch_id = v_branch
       and sale_date between v_from and v_to
       and item_name is not null and btrim(item_name) <> ''
     group by lower(btrim(item_name)), sale_date
  loop
    select id, fulfillment into v_ing_id, v_ful
      from ingredients
     where org_id = v_org and is_active
       and material_type in ('sales','both')
       and lower(btrim(name)) = s.key
     limit 1;

    if v_ing_id is null then
      if not (s.item_name = any(v_unmatched)) then
        v_unmatched := array_append(v_unmatched, s.item_name);
      end if;
      continue;
    end if;

    if coalesce(s.qty, 0) = 0 then
      continue;
    end if;

    if v_ful = 'stock' then
      -- made to stock: deduct finished-good stock only
      insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, source_table, occurred_at)
      values (v_org, v_branch, v_ing_id, 'consumption', -1 * s.qty, 'pos_sales', s.sale_date::timestamptz);
      v_matched := v_matched + 1;
    else
      -- made to order: backflush raw components via recipe
      for ri in
        select component_id, qty from item_recipe
         where org_id = v_org and sales_item_id = v_ing_id
      loop
        insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, source_table, occurred_at)
        values (v_org, v_branch, ri.component_id, 'consumption', -1 * s.qty * ri.qty, 'pos_sales', s.sale_date::timestamptz);
      end loop;
      v_matched := v_matched + 1;
    end if;
  end loop;

  return jsonb_build_object('matched', v_matched, 'unmatched', to_jsonb(v_unmatched));
end; $$;
