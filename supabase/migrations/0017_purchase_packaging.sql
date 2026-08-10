-- ============================================================
-- Purchases: separate "number of packages" from "pack size".
--
-- Staff enter: Product, Packaging (Packet/Bottle/Bag/Tin...), Pack Size
-- (e.g. 500 g), Purchase Qty (packages), Unit Price (per package).
-- The system computes the base/inventory quantity = pack_qty x pack_size
-- (converted to the product's base UOM) and the per-base unit cost.
--
-- We KEEP purchase_items.qty as the BASE quantity and rate as the per-base
-- cost, so inventory, FIFO cost layers, recipe costing and reports keep
-- working unchanged. The packaging fields are added alongside.
-- ============================================================

alter table purchase_items add column if not exists pack_qty          numeric(14,4);
alter table purchase_items add column if not exists pack_size         numeric(14,4);
alter table purchase_items add column if not exists pack_size_unit_id uuid references units(id);
alter table purchase_items add column if not exists purchase_uom      text;
alter table purchase_items add column if not exists unit_price        numeric(14,4);

-- Real conversion factors so to_base_qty() can normalize pack sizes.
-- Weight base = gram, volume base = millilitre, count base = piece.
update units set factor_to_base = 1000 where lower(abbr) in ('kg');
update units set factor_to_base = 1000 where lower(abbr) in ('lts','l','ltr');
update units set factor_to_base = 12   where lower(abbr) in ('dz');
update units set factor_to_base = 1    where lower(abbr) in ('gms','g','ml','qty','pcs','pc');

-- ---------- Post a purchase (packaging model, backward compatible) ----------
create or replace function public.post_purchase(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := (p->>'org_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_intra boolean;
  v_purchase uuid;
  v_sub numeric := 0; v_cgst numeric := 0; v_sgst numeric := 0; v_igst numeric := 0;
  it jsonb;
  v_taxable numeric; v_gst numeric; v_with numeric;
  v_pack_qty numeric; v_pack_size numeric; v_pack_unit uuid; v_unit_price numeric; v_gst_rate numeric;
  v_base_unit uuid; v_base_abbr text; v_pack_base numeric; v_qty_base numeric; v_rate numeric;
  v_mov uuid; v_vendor_state text; v_branch_state text; v_ingr uuid;
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
    v_ingr := (it->>'ingredient_id')::uuid;
    select base_unit_id into v_base_unit from ingredients where id = v_ingr;
    select abbr into v_base_abbr from units where id = v_base_unit;

    v_pack_qty   := nullif(it->>'pack_qty','')::numeric;
    v_pack_size  := nullif(it->>'pack_size','')::numeric;
    v_pack_unit  := nullif(it->>'pack_size_unit_id','')::uuid;
    v_unit_price := nullif(it->>'unit_price','')::numeric;
    v_gst_rate   := coalesce(nullif(it->>'gst_rate','')::numeric, 0);

    if v_pack_qty is not null then
      -- New packaging model.
      v_pack_base := to_base_qty(coalesce(v_pack_size, 0), v_pack_unit, v_base_unit);
      v_qty_base  := v_pack_qty * v_pack_base;
      v_taxable   := v_pack_qty * coalesce(v_unit_price, 0);
    else
      -- Backward-compatible fallback: old payload with qty (base) + rate (per base).
      v_qty_base := coalesce(nullif(it->>'qty','')::numeric, 0);
      v_taxable  := v_qty_base * coalesce(nullif(it->>'rate','')::numeric, 0);
      v_pack_qty := null; v_pack_size := null; v_pack_unit := null; v_unit_price := null;
    end if;

    -- GST: from gst_rate% by default; honor an explicit with_gst amount if sent.
    v_gst := v_taxable * v_gst_rate / 100.0;
    v_with := nullif(it->>'with_gst','')::numeric;
    if v_with is not null then
      if v_with > v_taxable then v_gst := v_with - v_taxable; else v_gst := 0; end if;
    end if;
    v_with := v_taxable + v_gst;

    v_rate := case when v_qty_base > 0 then v_taxable / v_qty_base else 0 end;  -- per base unit

    insert into purchase_items(purchase_id, ingredient_id, qty, rate, uom, category,
      pack_qty, pack_size, pack_size_unit_id, purchase_uom, unit_price,
      gst_rate, cgst, sgst, igst, hsn_code, line_total)
    values (v_purchase, v_ingr, v_qty_base, v_rate,
      coalesce(nullif(it->>'uom',''), v_base_abbr), nullif(it->>'category',''),
      v_pack_qty, v_pack_size, v_pack_unit, nullif(it->>'purchase_uom',''), v_unit_price,
      case when v_taxable > 0 then round(v_gst / v_taxable * 100, 2) else 0 end,
      case when v_intra then v_gst/2 else 0 end,
      case when v_intra then v_gst/2 else 0 end,
      case when v_intra then 0 else v_gst end,
      nullif(it->>'hsn_code',''), v_with);

    v_sub := v_sub + v_taxable;
    if v_intra then v_cgst := v_cgst + v_gst/2; v_sgst := v_sgst + v_gst/2;
    else v_igst := v_igst + v_gst; end if;

    insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, unit_cost, source_table, source_id)
    values (v_org, v_branch, v_ingr, 'purchase', v_qty_base, v_rate, 'purchases', v_purchase)
    returning id into v_mov;

    insert into inventory_cost_layers(org_id, branch_id, ingredient_id, qty_remaining, unit_cost, source_movement_id)
    values (v_org, v_branch, v_ingr, v_qty_base, v_rate, v_mov);

    insert into vendor_ingredients(vendor_id, ingredient_id, last_price)
    values ((p->>'vendor_id')::uuid, v_ingr, v_rate)
    on conflict (vendor_id, ingredient_id) do update set last_price = excluded.last_price;
  end loop;

  update purchases set subtotal = v_sub, cgst = v_cgst, sgst = v_sgst, igst = v_igst,
    total = v_sub + v_cgst + v_sgst + v_igst where id = v_purchase;
  return v_purchase;
end; $$;
