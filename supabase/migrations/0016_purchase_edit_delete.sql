-- ============================================================
-- Purchases: (1) reconcile schema so the register/form work on this DB,
-- (2) add edit (replace) and delete with a "stock already used" guard.
--
-- Background: the app's purchase register and form read/write
--   purchases.payment_mode, purchase_items.uom, purchase_items.category
-- and pass items as { ingredient_id, category, uom, qty, rate, with_gst }.
-- Those columns were never in the migrations, so on this database the
-- register SELECT errored and the page always showed the empty state,
-- even though purchases existed. Add the columns and align post_purchase.
-- ============================================================

alter table purchases      add column if not exists payment_mode text;
alter table purchase_items add column if not exists uom text;
alter table purchase_items add column if not exists category text;

-- ---------- Post a purchase (aligned to the app payload) ----------
-- Qty is entered in the item's own base UOM, so it is used directly as the
-- base quantity for inventory. GST is derived from the optional "with_gst"
-- (amount incl. GST) the form sends.
create or replace function public.post_purchase(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := (p->>'org_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_intra boolean;
  v_purchase uuid;
  v_sub numeric := 0; v_cgst numeric := 0; v_sgst numeric := 0; v_igst numeric := 0;
  it jsonb; v_taxable numeric; v_gst numeric; v_with numeric; v_qty numeric; v_rate numeric;
  v_qty_base numeric; v_mov uuid;
  v_vendor_state text; v_branch_state text;
begin
  if my_role(v_org) not in ('owner','manager','accountant') then raise exception 'forbidden'; end if;

  select state_code into v_branch_state from branches where id = v_branch;
  select state_code into v_vendor_state from vendors  where id = (p->>'vendor_id')::uuid;
  v_intra := (v_vendor_state is not distinct from v_branch_state);

  insert into purchases(org_id, branch_id, vendor_id, bill_no, bill_date, payment_mode, payment_status)
  values (v_org, v_branch, (p->>'vendor_id')::uuid, nullif(p->>'bill_no',''),
          coalesce((p->>'bill_date')::date, current_date), nullif(p->>'payment_mode',''), 'unpaid')
  returning id into v_purchase;

  for it in select * from jsonb_array_elements(p->'items') loop
    v_qty  := coalesce((it->>'qty')::numeric, 0);
    v_rate := coalesce((it->>'rate')::numeric, 0);
    v_taxable := v_qty * v_rate;
    v_with := nullif(it->>'with_gst','')::numeric;
    if v_with is not null and v_with > v_taxable then
      v_gst := v_with - v_taxable;
    else
      v_gst := 0; v_with := v_taxable;
    end if;

    insert into purchase_items(purchase_id, ingredient_id, qty, rate, uom, category,
      gst_rate, cgst, sgst, igst, hsn_code, line_total)
    values (v_purchase, (it->>'ingredient_id')::uuid, v_qty, v_rate,
      nullif(it->>'uom',''), nullif(it->>'category',''),
      case when v_taxable > 0 then round(v_gst / v_taxable * 100, 2) else 0 end,
      case when v_intra then v_gst/2 else 0 end,
      case when v_intra then v_gst/2 else 0 end,
      case when v_intra then 0 else v_gst end,
      nullif(it->>'hsn_code',''), v_with);

    v_sub := v_sub + v_taxable;
    if v_intra then v_cgst := v_cgst + v_gst/2; v_sgst := v_sgst + v_gst/2;
    else v_igst := v_igst + v_gst; end if;

    v_qty_base := v_qty; -- entered in the item's base UOM
    insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, unit_cost, source_table, source_id)
    values (v_org, v_branch, (it->>'ingredient_id')::uuid, 'purchase', v_qty_base,
      case when v_qty_base = 0 then 0 else v_taxable / v_qty_base end, 'purchases', v_purchase)
    returning id into v_mov;

    insert into inventory_cost_layers(org_id, branch_id, ingredient_id, qty_remaining, unit_cost, source_movement_id)
    values (v_org, v_branch, (it->>'ingredient_id')::uuid, v_qty_base,
      case when v_qty_base = 0 then 0 else v_taxable / v_qty_base end, v_mov);

    insert into vendor_ingredients(vendor_id, ingredient_id, last_price)
    values ((p->>'vendor_id')::uuid, (it->>'ingredient_id')::uuid, v_rate)
    on conflict (vendor_id, ingredient_id) do update set last_price = excluded.last_price;
  end loop;

  update purchases set subtotal = v_sub, cgst = v_cgst, sgst = v_sgst, igst = v_igst,
    total = v_sub + v_cgst + v_sgst + v_igst where id = v_purchase;
  return v_purchase;
end; $$;

-- ---------- Delete a whole purchase bill (reverse its stock) ----------
-- Blocks if any of the stock this bill added has already been consumed
-- (a cost layer with qty_remaining < the quantity that was received),
-- so inventory value and food-cost stay accurate.
create or replace function public.delete_purchase(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_used boolean;
begin
  select org_id into v_org from purchases where id = p_id;
  if v_org is null then raise exception 'not_found'; end if;
  if my_role(v_org) not in ('owner','manager','accountant') then raise exception 'forbidden'; end if;

  select exists(
    select 1 from inventory_cost_layers l
    join inventory_movements m on m.id = l.source_movement_id
    where m.source_table = 'purchases' and m.source_id = p_id
      and l.qty_remaining < m.qty
  ) into v_used;
  if v_used then raise exception 'stock_used'; end if;

  delete from inventory_cost_layers l using inventory_movements m
    where l.source_movement_id = m.id and m.source_table = 'purchases' and m.source_id = p_id;
  delete from inventory_movements where source_table = 'purchases' and source_id = p_id;
  delete from purchase_items where purchase_id = p_id;
  delete from purchases where id = p_id;
end; $$;

-- ---------- Replace a purchase (edit = reverse old + post new), atomically ----------
create or replace function public.replace_purchase(p_id uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_new uuid;
begin
  perform public.delete_purchase(p_id);   -- carries authz + stock-used guard
  v_new := public.post_purchase(p);
  return v_new;
end; $$;

grant execute on function public.delete_purchase(uuid) to authenticated;
grant execute on function public.replace_purchase(uuid, jsonb) to authenticated;
