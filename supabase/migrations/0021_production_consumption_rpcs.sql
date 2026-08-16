-- ============================================================
-- Romancham — Production & Consumption (Phase 2: ledger service + FIFO)
-- ============================================================
-- All stock mutations for finished goods go through these SECURITY DEFINER
-- RPCs. They append to stock_ledger (never edit) and allocate batches FIFO
-- (oldest production_date first). Raw-material consumption during a batch
-- keeps using the existing inventory_movements + inventory_cost_layers, so
-- nothing about the current raw-stock behaviour changes.
-- Idempotent where practical; safe to re-run (create-or-replace).
-- ============================================================

-- ---------- POS exceptions queue (missing mapping / oversold) ----------
create table if not exists public.pos_exception (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  branch_id     uuid not null references branches(id) on delete cascade,
  sale_date     date not null default current_date,
  item_name     text,
  qty           numeric(14,4) default 0,
  reason        text not null,              -- 'unmapped' | 'oversold'
  detail        text,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists pos_exception_lookup_idx
  on public.pos_exception (org_id, branch_id, sale_date)
  where resolved_at is null;

alter table public.pos_exception enable row level security;
drop policy if exists pos_exception_read on public.pos_exception;
create policy pos_exception_read on public.pos_exception for select
  using (org_id in (select my_org_ids()) and branch_id in (select my_branch_ids(org_id)));
drop policy if exists pos_exception_write on public.pos_exception;
create policy pos_exception_write on public.pos_exception for all
  using (org_id in (select my_org_ids()) and my_role(org_id) in ('owner','manager','accountant','staff'))
  with check (org_id in (select my_org_ids()));
grant select, insert, update, delete on public.pos_exception to authenticated;

-- ============================================================
-- Helpers
-- ============================================================

-- Is a business date locked (period closed)? Owners/managers may override.
create or replace function public.pc_period_locked(p_org uuid, p_branch uuid, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from consumption_period
     where org_id = p_org and branch_id = p_branch
       and business_date = p_date and status = 'closed'
  );
$$;

-- Guard: raise if the date is locked and the caller can't override.
create or replace function public.pc_guard_date(p_org uuid, p_branch uuid, p_date date)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if pc_period_locked(p_org, p_branch, p_date)
     and my_role(p_org) not in ('owner','manager') then
    raise exception 'Day % is closed. Ask an owner/manager to reopen it.', p_date;
  end if;
end; $$;

-- Latest known unit cost for a raw ingredient (cost layer, else vendor price).
create or replace function public.pc_raw_unit_cost(p_org uuid, p_branch uuid, p_ing uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select unit_cost from inventory_cost_layers
       where org_id = p_org and branch_id = p_branch and ingredient_id = p_ing
       order by received_at desc limit 1),
    (select last_price from vendor_ingredients where ingredient_id = p_ing
       order by last_price desc nulls last limit 1),
    0);
$$;

-- Next batch code: <3-letter item prefix>-YYYYMMDD-NN
create or replace function public.pc_next_batch_code(p_org uuid, p_item uuid, p_date date)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_prefix text; v_seq int;
begin
  select upper(regexp_replace(coalesce(name,'BAT'), '[^A-Za-z]', '', 'g')) into v_prefix
    from ingredients where id = p_item;
  v_prefix := coalesce(nullif(left(v_prefix,3),''),'BAT');
  select count(*) + 1 into v_seq from production_batch
    where org_id = p_org and sales_item_id = p_item and production_date = p_date;
  return v_prefix || '-' || to_char(p_date,'YYYYMMDD') || '-' || lpad(v_seq::text,2,'0');
end; $$;

-- On-hand qty for one batch at one location (from the ledger).
create or replace function public.pc_batch_onhand(p_org uuid, p_branch uuid, p_batch uuid, p_loc stock_location_t)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(qty),0) from stock_ledger
   where org_id = p_org and branch_id = p_branch
     and batch_id = p_batch and location = p_loc;
$$;

-- ============================================================
-- post_production_batch
--   Consumes raw (inventory_movements + FIFO cost layers) and posts a
--   'production_output' row into STORE for the finished good.
-- ============================================================
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
  for ri in select component_id, qty from item_recipe
             where org_id = v_org and sales_item_id = v_item loop
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

-- ============================================================
-- post_stock_transfer  (Store -> Display, FIFO by batch)
-- ============================================================
create or replace function public.post_stock_transfer(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid := (p->>'org_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_item   uuid := (p->>'sales_item_id')::uuid;
  v_qty    numeric := coalesce((p->>'qty')::numeric, 0);
  v_date   date := coalesce((p->>'transfer_date')::date, current_date);
  v_from   stock_location_t := coalesce((p->>'from_location')::stock_location_t, 'store');
  v_to     stock_location_t := coalesce((p->>'to_location')::stock_location_t, 'display');
  v_uom    uuid;
  v_transfer uuid;
  v_remaining numeric;
  b        record;
  v_take   numeric;
  v_avail  numeric;
begin
  if my_role(v_org) not in ('owner','manager','accountant','staff') then raise exception 'forbidden'; end if;
  if v_qty is null or v_qty <= 0 then raise exception 'Transfer quantity must be greater than 0'; end if;
  if v_from = v_to then raise exception 'From and To locations must differ'; end if;
  perform pc_guard_date(v_org, v_branch, v_date);

  select base_unit_id into v_uom from ingredients where id = v_item;
  v_remaining := v_qty;

  insert into stock_transfer(org_id, branch_id, transfer_date, from_location, to_location, sales_item_id, qty, uom_id, note, created_by)
  values (v_org, v_branch, v_date, v_from, v_to, v_item, v_qty, v_uom, nullif(btrim(p->>'note'),''), auth.uid())
  returning id into v_transfer;

  for b in select pb.id, pb.cost_per_stock_unit
             from production_batch pb
            where pb.org_id = v_org and pb.branch_id = v_branch and pb.sales_item_id = v_item
            order by pb.production_date asc, pb.created_at asc loop
    exit when v_remaining <= 0;
    v_avail := pc_batch_onhand(v_org, v_branch, b.id, v_from);
    if v_avail <= 0 then continue; end if;
    v_take := least(v_avail, v_remaining);
    -- out of `from`
    insert into stock_ledger(org_id, branch_id, txn_date, txn_type, item_kind, item_id, batch_id, location, qty, uom_id, unit_cost, total_value, ref_table, ref_id, created_by)
    values (v_org, v_branch, v_date::timestamptz, 'transfer', 'finished', v_item, b.id, v_from,
            -1 * v_take, v_uom, b.cost_per_stock_unit, round(-1 * v_take * b.cost_per_stock_unit,2), 'stock_transfer', v_transfer, auth.uid());
    -- into `to`
    insert into stock_ledger(org_id, branch_id, txn_date, txn_type, item_kind, item_id, batch_id, location, qty, uom_id, unit_cost, total_value, ref_table, ref_id, created_by)
    values (v_org, v_branch, v_date::timestamptz, 'transfer', 'finished', v_item, b.id, v_to,
            v_take, v_uom, b.cost_per_stock_unit, round(v_take * b.cost_per_stock_unit,2), 'stock_transfer', v_transfer, auth.uid());
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'Only % available in %; cannot transfer % of that item.', (v_qty - v_remaining), v_from, v_qty;
  end if;

  return v_transfer;
end; $$;

-- ============================================================
-- post_wastage_finished  (write off finished goods, FIFO by batch)
-- ============================================================
create or replace function public.post_wastage_finished(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid := (p->>'org_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_item   uuid := (p->>'sales_item_id')::uuid;
  v_qty    numeric := coalesce((p->>'qty')::numeric, 0);
  v_date   date := coalesce((p->>'wastage_date')::date, current_date);
  v_loc    stock_location_t := coalesce((p->>'location')::stock_location_t, 'display');
  v_reason wastage_reason_t := (p->>'reason')::wastage_reason_t;
  v_uom    uuid;
  v_entry  uuid;
  v_remaining numeric;
  v_value  numeric := 0;
  b        record;
  v_take   numeric;
  v_avail  numeric;
begin
  if my_role(v_org) not in ('owner','manager','accountant','staff') then raise exception 'forbidden'; end if;
  if v_qty is null or v_qty <= 0 then raise exception 'Wastage quantity must be greater than 0'; end if;
  if v_reason is null then raise exception 'Select a wastage reason'; end if;
  perform pc_guard_date(v_org, v_branch, v_date);

  select base_unit_id into v_uom from ingredients where id = v_item;
  v_remaining := v_qty;

  insert into wastage_entry(org_id, branch_id, wastage_date, sales_item_id, location, qty, uom_id, reason, value_lost, notes, recorded_by)
  values (v_org, v_branch, v_date, v_item, v_loc, v_qty, v_uom, v_reason, 0, nullif(btrim(p->>'notes'),''), auth.uid())
  returning id into v_entry;

  for b in select pb.id, pb.cost_per_stock_unit
             from production_batch pb
            where pb.org_id = v_org and pb.branch_id = v_branch and pb.sales_item_id = v_item
            order by pb.production_date asc, pb.created_at asc loop
    exit when v_remaining <= 0;
    v_avail := pc_batch_onhand(v_org, v_branch, b.id, v_loc);
    if v_avail <= 0 then continue; end if;
    v_take := least(v_avail, v_remaining);
    v_value := v_value + v_take * b.cost_per_stock_unit;
    insert into stock_ledger(org_id, branch_id, txn_date, txn_type, item_kind, item_id, batch_id, location, qty, uom_id, unit_cost, total_value, ref_table, ref_id, created_by)
    values (v_org, v_branch, v_date::timestamptz, 'wastage', 'finished', v_item, b.id, v_loc,
            -1 * v_take, v_uom, b.cost_per_stock_unit, round(-1 * v_take * b.cost_per_stock_unit,2), 'wastage_entry', v_entry, auth.uid());
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'Only % available in %; cannot waste % of that item.', (v_qty - v_remaining), v_loc, v_qty;
  end if;

  update wastage_entry set value_lost = round(v_value,2) where id = v_entry;
  return v_entry;
end; $$;

-- ============================================================
-- submit_physical_count  (blind count -> compute variance; adjust on approve)
-- ============================================================
create or replace function public.submit_physical_count(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid := (p->>'org_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_item   uuid := (p->>'sales_item_id')::uuid;
  v_counted numeric := coalesce((p->>'counted_qty')::numeric, 0);
  v_date   date := coalesce((p->>'count_date')::date, current_date);
  v_loc    stock_location_t := coalesce((p->>'location')::stock_location_t, 'display');
  v_uom    uuid;
  v_system numeric;
  v_var    numeric;
  v_cost   numeric;
  v_count_id uuid;
begin
  if my_role(v_org) not in ('owner','manager','accountant','staff') then raise exception 'forbidden'; end if;
  perform pc_guard_date(v_org, v_branch, v_date);

  select base_unit_id into v_uom from ingredients where id = v_item;
  select coalesce(sum(qty),0) into v_system from stock_ledger
    where org_id = v_org and branch_id = v_branch and item_id = v_item and location = v_loc;
  v_var := v_counted - v_system;
  -- value the variance at the item's average finished cost
  select coalesce(avg(nullif(cost_per_stock_unit,0)),0) into v_cost from production_batch
    where org_id = v_org and branch_id = v_branch and sales_item_id = v_item;

  insert into physical_count(org_id, branch_id, count_date, location, sales_item_id,
      system_qty, counted_qty, variance_qty, variance_pct, variance_value, uom_id, explanation, counted_by)
  values (v_org, v_branch, v_date, v_loc, v_item,
      v_system, v_counted, v_var,
      case when v_system = 0 then 0 else round(v_var / v_system * 100, 4) end,
      round(v_var * v_cost, 2), v_uom, nullif(btrim(p->>'explanation'),''), auth.uid())
  returning id into v_count_id;

  return jsonb_build_object('id', v_count_id, 'system_qty', v_system, 'counted_qty', v_counted,
    'variance_qty', v_var, 'variance_value', round(v_var * v_cost, 2));
end; $$;

-- Approve a count: posts an 'adjustment' ledger row for the variance.
create or replace function public.approve_physical_count(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := (p->>'org_id')::uuid;
  v_id  uuid := (p->>'count_id')::uuid;
  c     record;
begin
  if my_role(v_org) not in ('owner','manager') then raise exception 'Only owner/manager can approve counts'; end if;
  select * into c from physical_count where id = v_id and org_id = v_org;
  if c is null then raise exception 'Count not found'; end if;
  if c.approval_status = 'approved' then return; end if;

  if c.variance_qty <> 0 then
    insert into stock_ledger(org_id, branch_id, txn_date, txn_type, item_kind, item_id, batch_id, location, qty, uom_id, unit_cost, total_value, ref_table, ref_id, created_by)
    values (v_org, c.branch_id, now(), 'adjustment', 'finished', c.sales_item_id, null, c.location,
            c.variance_qty, c.uom_id,
            case when c.variance_qty = 0 then 0 else abs(c.variance_value / c.variance_qty) end,
            c.variance_value, 'physical_count', c.id, auth.uid());
  end if;
  update physical_count set approval_status = 'approved', approved_by = auth.uid() where id = v_id;
end; $$;

-- ============================================================
-- reverse_stock_ledger  (post opposite rows; originals untouched)
-- ============================================================
create or replace function public.reverse_stock_ledger(p jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := (p->>'org_id')::uuid;
  v_ref_table text := p->>'ref_table';
  v_ref_id uuid := (p->>'ref_id')::uuid;
  r record; v_n int := 0;
begin
  if my_role(v_org) not in ('owner','manager') then raise exception 'Only owner/manager can reverse'; end if;
  for r in select * from stock_ledger
            where org_id = v_org and ref_table = v_ref_table and ref_id = v_ref_id
              and txn_type <> 'reversal' and reversal_ref is null loop
    insert into stock_ledger(org_id, branch_id, txn_date, txn_type, item_kind, item_id, batch_id, location, qty, uom_id, unit_cost, total_value, ref_table, ref_id, reversal_ref, created_by)
    values (r.org_id, r.branch_id, now(), 'reversal', r.item_kind, r.item_id, r.batch_id, r.location,
            -1 * r.qty, r.uom_id, r.unit_cost, -1 * r.total_value, r.ref_table, r.ref_id, r.id, auth.uid());
    v_n := v_n + 1;
  end loop;
  return v_n;
end; $$;

-- ============================================================
-- close / reopen a consumption period (day)
-- ============================================================
create or replace function public.close_consumption_period(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := (p->>'org_id')::uuid; v_branch uuid := (p->>'branch_id')::uuid; v_date date := (p->>'business_date')::date;
begin
  if my_role(v_org) not in ('owner','manager') then raise exception 'Only owner/manager can close a day'; end if;
  insert into consumption_period(org_id, branch_id, business_date, status, closed_by, closed_at)
  values (v_org, v_branch, v_date, 'closed', auth.uid(), now())
  on conflict (org_id, branch_id, business_date)
  do update set status = 'closed', closed_by = auth.uid(), closed_at = now();
end; $$;

create or replace function public.reopen_consumption_period(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := (p->>'org_id')::uuid; v_branch uuid := (p->>'branch_id')::uuid; v_date date := (p->>'business_date')::date;
begin
  if my_role(v_org) not in ('owner','manager') then raise exception 'Only owner/manager can reopen a day'; end if;
  update consumption_period set status = 'open', closed_by = null, closed_at = null
   where org_id = v_org and branch_id = v_branch and business_date = v_date;
end; $$;

-- ============================================================
-- sync_finished_sales  (POS -> deduct DISPLAY, FIFO; exceptions queue)
--   Idempotent for a date range: wipes prior sale/reversal rows sourced
--   from pos_sales in range, clears open exceptions, then re-derives.
--   Never rejects: unmapped -> pos_exception; oversold -> negative + warn.
-- ============================================================
create or replace function public.sync_finished_sales(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := (p->>'org_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_from date := coalesce((p->>'from')::date, date '1900-01-01');
  v_to   date := coalesce((p->>'to')::date, date '2999-12-31');
  s record; b record;
  v_ing uuid; v_ful text; v_uom uuid;
  v_remaining numeric; v_take numeric; v_avail numeric;
  v_matched int := 0; v_oversold int := 0; v_unmapped int := 0;
begin
  if my_role(v_org) not in ('owner','manager','accountant','staff') then raise exception 'forbidden'; end if;

  delete from stock_ledger
    where org_id = v_org and branch_id = v_branch and ref_table = 'pos_sales'
      and txn_date::date between v_from and v_to;
  delete from pos_exception
    where org_id = v_org and branch_id = v_branch and sale_date between v_from and v_to
      and resolved_at is null;

  for s in
    select lower(btrim(item_name)) as key, min(item_name) as item_name,
           sale_date, sum(coalesce(qty,0)) as qty
      from pos_sales
     where org_id = v_org and branch_id = v_branch and sale_date between v_from and v_to
       and item_name is not null and btrim(item_name) <> ''
     group by lower(btrim(item_name)), sale_date
  loop
    select id, fulfillment, base_unit_id into v_ing, v_ful, v_uom
      from ingredients
     where org_id = v_org and is_active and material_type in ('sales','both')
       and lower(btrim(name)) = s.key limit 1;

    if v_ing is null then
      insert into pos_exception(org_id, branch_id, sale_date, item_name, qty, reason, detail)
      values (v_org, v_branch, s.sale_date, s.item_name, s.qty, 'unmapped',
              'No matching sales item — create/rename it in Ingredients, then re-sync.');
      v_unmapped := v_unmapped + 1;
      continue;
    end if;

    -- Only BATCH_PRODUCED ('stock') deducts finished display stock here.
    -- MADE_TO_ORDER ('direct') is handled by sync_sales_consumption (raw backflush).
    if v_ful <> 'stock' then continue; end if;
    if coalesce(s.qty,0) = 0 then continue; end if;

    v_remaining := s.qty;
    for b in select pb.id, pb.cost_per_stock_unit
               from production_batch pb
              where pb.org_id = v_org and pb.branch_id = v_branch and pb.sales_item_id = v_ing
              order by pb.production_date asc, pb.created_at asc loop
      exit when v_remaining <= 0;
      v_avail := pc_batch_onhand(v_org, v_branch, b.id, 'display');
      if v_avail <= 0 then continue; end if;
      v_take := least(v_avail, v_remaining);
      insert into stock_ledger(org_id, branch_id, txn_date, txn_type, item_kind, item_id, batch_id, location, qty, uom_id, unit_cost, total_value, ref_table, created_by)
      values (v_org, v_branch, s.sale_date::timestamptz, 'sale', 'finished', v_ing, b.id, 'display',
              -1 * v_take, v_uom, b.cost_per_stock_unit, round(-1 * v_take * b.cost_per_stock_unit,2), 'pos_sales', auth.uid());
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      -- oversold: allow negative display stock against no batch + flag warning
      insert into stock_ledger(org_id, branch_id, txn_date, txn_type, item_kind, item_id, batch_id, location, qty, uom_id, unit_cost, total_value, ref_table, created_by)
      values (v_org, v_branch, s.sale_date::timestamptz, 'sale', 'finished', v_ing, null, 'display',
              -1 * v_remaining, v_uom, 0, 0, 'pos_sales', auth.uid());
      insert into pos_exception(org_id, branch_id, sale_date, item_name, qty, reason, detail)
      values (v_org, v_branch, s.sale_date, s.item_name, v_remaining, 'oversold',
              'Sold more than transferred to display — transfer stock or check counts.');
      v_oversold := v_oversold + 1;
    end if;
    v_matched := v_matched + 1;
  end loop;

  return jsonb_build_object('matched', v_matched, 'oversold', v_oversold, 'unmapped', v_unmapped);
end; $$;

-- ============================================================
-- Grants
-- ============================================================
grant execute on function
  public.post_production_batch(jsonb), public.post_stock_transfer(jsonb),
  public.post_wastage_finished(jsonb), public.submit_physical_count(jsonb),
  public.approve_physical_count(jsonb), public.reverse_stock_ledger(jsonb),
  public.close_consumption_period(jsonb), public.reopen_consumption_period(jsonb),
  public.sync_finished_sales(jsonb)
  to authenticated;
