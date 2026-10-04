-- ============================================================
-- Romancham — Prep / Component recipes + recipe roll-up
--   RAW  -> PREP (batch, final yield) -> FINAL DISH -> MENU ENGINEERING
--
-- * ingredients.material_type gains the value 'prep' (no constraint to change)
-- * ingredients.yield_pct : usable % of a raw ingredient (trim/peel loss)
-- * recipe_header         : one row per recipe (prep | dish), final yield, notes
-- * item_recipe           : + entry_qty / entry_unit_id / sort_order (what the cook typed).
--                           item_recipe.qty stays "component base units per ONE base
--                           unit of the parent's output", so all stock logic keeps working.
-- * explode_recipe()      : expands preps into raw ingredients (recursive), grossed up
--                           by yield %, used by every stock-deducting function.
-- Additive & idempotent. Existing recipes become 'dish' with yield 1.
-- ============================================================

alter table public.ingredients add column if not exists yield_pct numeric(6,2) not null default 100;
do $$ begin
  alter table public.ingredients add constraint ingredients_yield_pct_chk check (yield_pct > 0 and yield_pct <= 100);
exception when duplicate_object then null; end $$;

alter table public.item_recipe add column if not exists entry_qty numeric(14,4);
alter table public.item_recipe add column if not exists entry_unit_id uuid references public.units(id);
alter table public.item_recipe add column if not exists sort_order int not null default 0;

create table if not exists public.recipe_header (
  item_id uuid primary key references public.ingredients(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  recipe_type text not null default 'dish' check (recipe_type in ('prep','dish')),
  yield_qty numeric(14,4) not null default 1 check (yield_qty > 0),
  notes text,
  shelf_life_days int,
  storage text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
create index if not exists recipe_header_org_idx on public.recipe_header(org_id, recipe_type);
alter table public.recipe_header enable row level security;
drop policy if exists recipe_header_read on public.recipe_header;
create policy recipe_header_read on public.recipe_header for select using (org_id in (select my_org_ids()));
drop policy if exists recipe_header_write on public.recipe_header;
create policy recipe_header_write on public.recipe_header for all
  using (org_id in (select my_org_ids()) and my_role(org_id) in ('owner','manager','accountant','staff'))
  with check (org_id in (select my_org_ids()) and my_role(org_id) in ('owner','manager','accountant','staff'));

-- Existing recipes = final dishes, 1 portion.
insert into public.recipe_header (item_id, org_id, recipe_type, yield_qty)
select distinct sales_item_id, org_id, 'dish', 1 from public.item_recipe
on conflict (item_id) do nothing;

-- Raw-ingredient requirement for ONE base unit of p_item, expanding preps
-- (any depth, max 10) and grossing up by each raw item's usable yield %.
create or replace function public.explode_recipe(p_org uuid, p_item uuid)
returns table(component_id uuid, qty numeric)
language sql stable security definer set search_path = public as $$
  with recursive t(item, q, depth, path) as (
    select ri.component_id, ri.qty::numeric, 1, array[p_item, ri.component_id]
      from item_recipe ri where ri.org_id = p_org and ri.sales_item_id = p_item
    union all
    select ri.component_id, t.q * ri.qty, t.depth + 1, t.path || ri.component_id
      from t
      join ingredients i on i.id = t.item and i.material_type = 'prep'
      join item_recipe ri on ri.org_id = p_org and ri.sales_item_id = t.item
     where t.depth < 10 and not (ri.component_id = any(t.path))
  )
  select t.item, sum(t.q / (coalesce(nullif(i.yield_pct,0),100) / 100.0))
    from t join ingredients i on i.id = t.item
   where not (i.material_type = 'prep'
              and exists (select 1 from item_recipe x where x.org_id = p_org and x.sales_item_id = t.item))
   group by t.item;
$$;
grant execute on function public.explode_recipe(uuid, uuid) to authenticated;

-- Stock-deducting functions: identical to before except they now read
-- explode_recipe() instead of item_recipe directly.

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
    select component_id, qty from explode_recipe(v_org, v_item)
  loop
    insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, source_table, source_id, occurred_at)
    values (v_org, v_branch, ri.component_id, 'consumption', -1 * v_qty * ri.qty, 'productions', v_prod, v_on::timestamptz);
  end loop;

  -- add finished-good stock (movement_type 'adjustment', tagged by source_table)
  insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, source_table, source_id, occurred_at)
  values (v_org, v_branch, v_item, 'adjustment', v_qty, 'productions', v_prod, v_on::timestamptz);

  return v_prod;
end; $$;

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
        select component_id, qty from explode_recipe(v_org, v_ing_id)
      loop
        insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, source_table, occurred_at)
        values (v_org, v_branch, ri.component_id, 'consumption', -1 * s.qty * ri.qty, 'pos_sales', s.sale_date::timestamptz);
      end loop;
      v_matched := v_matched + 1;
    end if;
  end loop;

  return jsonb_build_object('matched', v_matched, 'unmatched', to_jsonb(v_unmatched));
end; $$;

create or replace function public.post_production_batch(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid := (p->>'org_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_item   uuid := (p->>'sales_item_id')::uuid;
  v_plan   numeric := coalesce((p->>'planned_qty')::numeric, 0);
  v_yield  numeric := coalesce((p->>'actual_yield')::numeric, 0);
  v_ppu    numeric := nullif((p->>'portions_per_unit')::numeric, 0);
  v_date   date := coalesce((p->>'production_date')::date, current_date);
  v_expiry date := (p->>'expiry_date')::date;
  v_code   text := nullif(btrim(p->>'batch_code'), '');
  v_uom    uuid;
  v_batch  uuid;
  v_rawcost numeric := 0;
  v_cpsu   numeric := 0;
  ri       record;
  layer    record;
  v_need   numeric;
  v_take   numeric;
  v_line   numeric;
begin
  if my_role(v_org) not in ('owner','manager','accountant','staff') then raise exception 'forbidden'; end if;
  if v_item is null then raise exception 'Select a finished good'; end if;
  if v_yield is null or v_yield <= 0 then raise exception 'Actual yield must be greater than 0'; end if;
  perform pc_guard_date(v_org, v_branch, v_date);

  select base_unit_id into v_uom from ingredients where id = v_item;
  if v_code is null then v_code := pc_next_batch_code(v_org, v_item, v_date); end if;

  -- Consume raw materials via the recipe (qty is per 1 sellable unit).
  for ri in select component_id, qty from explode_recipe(v_org, v_item) loop
    v_need := v_yield * ri.qty;                     -- in raw base units
    -- FIFO deplete cost layers for valuation
    for layer in select * from inventory_cost_layers
                  where org_id = v_org and branch_id = v_branch and ingredient_id = ri.component_id
                    and qty_remaining > 0 order by received_at asc loop
      exit when v_need <= 0;
      v_take := least(layer.qty_remaining, v_need);
      v_line := v_take * layer.unit_cost;
      v_rawcost := v_rawcost + v_line;
      update inventory_cost_layers set qty_remaining = qty_remaining - v_take where id = layer.id;
      v_need := v_need - v_take;
    end loop;
    -- any shortfall valued at latest known cost (does not block production)
    if v_need > 0 then
      v_rawcost := v_rawcost + v_need * pc_raw_unit_cost(v_org, v_branch, ri.component_id);
    end if;
    -- record raw consumption movement (negative, full requirement)
    insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, unit_cost, source_table, source_id, occurred_at)
    values (v_org, v_branch, ri.component_id, 'consumption', -1 * v_yield * ri.qty,
            pc_raw_unit_cost(v_org, v_branch, ri.component_id), 'production_batch', null, v_date::timestamptz);
  end loop;

  v_cpsu := case when v_yield = 0 then 0 else v_rawcost / v_yield end;

  insert into production_batch(
    org_id, branch_id, batch_code, sales_item_id, recipe_version, production_date,
    planned_qty, actual_yield, expected_portions, actual_portions,
    raw_material_cost, cost_per_stock_unit, cost_per_portion, expiry_date, status, note, created_by)
  values (
    v_org, v_branch, v_code, v_item, (p->>'recipe_version')::int, v_date,
    v_plan, v_yield,
    case when v_ppu is null then null else v_plan * v_ppu end,
    case when v_ppu is null then null else v_yield * v_ppu end,
    round(v_rawcost,2), round(v_cpsu,4),
    case when v_ppu is null then 0 else round(v_cpsu / v_ppu, 4) end,
    v_expiry, 'active', nullif(btrim(p->>'note'),''), auth.uid())
  returning id into v_batch;

  -- Finished output into STORE.
  insert into stock_ledger(org_id, branch_id, txn_date, txn_type, item_kind, item_id, batch_id, location, qty, uom_id, unit_cost, total_value, ref_table, ref_id, created_by)
  values (v_org, v_branch, v_date::timestamptz, 'production_output', 'finished', v_item, v_batch, 'store',
          v_yield, v_uom, round(v_cpsu,4), round(v_yield * v_cpsu, 2), 'production_batch', v_batch, auth.uid());

  return v_batch;
end; $$;
