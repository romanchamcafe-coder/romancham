-- ============================================================
-- Brewmetrics — Domain RPC functions
-- ============================================================

-- Convert a qty in `from_unit` into the ingredient's base unit
create or replace function public.to_base_qty(p_qty numeric, p_from_unit uuid, p_base_unit uuid)
returns numeric language plpgsql stable as $$
declare f_from numeric; f_base numeric;
begin
  if p_from_unit is null or p_base_unit is null or p_from_unit = p_base_unit then
    return p_qty;
  end if;
  select factor_to_base into f_from from units where id = p_from_unit;
  select factor_to_base into f_base from units where id = p_base_unit;
  return p_qty * coalesce(f_from,1) / coalesce(nullif(f_base,0),1);
end; $$;

-- ---------- Bootstrap a new organization (owner + first branch) ----------
create or replace function public.bootstrap_org(p_name text, p_slug text, p_branch text default 'Main Branch', p_state text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_branch uuid; v_mem uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into organizations(name, slug, state_code) values (p_name, p_slug, p_state) returning id into v_org;
  insert into branches(org_id, name, state_code) values (v_org, p_branch, p_state) returning id into v_branch;
  insert into memberships(org_id, user_id, role) values (v_org, auth.uid(), 'owner') returning id into v_mem;
  insert into membership_branches(membership_id, branch_id) values (v_mem, v_branch);
  return v_org;
end; $$;

-- ---------- Post a purchase: items + GST + inventory IN + FIFO layers ----------
create or replace function public.post_purchase(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := (p->>'org_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_intra boolean;
  v_purchase uuid;
  v_sub numeric := 0; v_cgst numeric := 0; v_sgst numeric := 0; v_igst numeric := 0;
  it jsonb; v_taxable numeric; v_gst numeric; v_qty_base numeric; v_base_unit uuid; v_mov uuid;
  v_vendor_state text; v_branch_state text;
begin
  -- authz: caller must belong to org with a writing role
  if my_role(v_org) not in ('owner','manager','accountant') then raise exception 'forbidden'; end if;

  select state_code into v_branch_state from branches where id = v_branch;
  select state_code into v_vendor_state from vendors where id = (p->>'vendor_id')::uuid;
  v_intra := (v_vendor_state is not distinct from v_branch_state);

  insert into purchases(org_id, branch_id, vendor_id, bill_no, bill_date, due_date, payment_status, bill_file_path, notes)
  values (v_org, v_branch, (p->>'vendor_id')::uuid, p->>'bill_no', coalesce((p->>'bill_date')::date, current_date),
          (p->>'due_date')::date, coalesce((p->>'payment_status')::pay_status_t,'unpaid'), p->>'bill_file_path', p->>'notes')
  returning id into v_purchase;

  for it in select * from jsonb_array_elements(p->'items') loop
    v_taxable := (it->>'qty')::numeric * (it->>'rate')::numeric;
    v_gst := v_taxable * coalesce((it->>'gst_rate')::numeric,0) / 100.0;
    insert into purchase_items(purchase_id, ingredient_id, qty, unit_id, rate, gst_rate,
      cgst, sgst, igst, hsn_code, line_total)
    values (v_purchase, (it->>'ingredient_id')::uuid, (it->>'qty')::numeric, (it->>'unit_id')::uuid,
      (it->>'rate')::numeric, coalesce((it->>'gst_rate')::numeric,0),
      case when v_intra then v_gst/2 else 0 end,
      case when v_intra then v_gst/2 else 0 end,
      case when v_intra then 0 else v_gst end,
      it->>'hsn_code', v_taxable + v_gst);

    v_sub := v_sub + v_taxable;
    if v_intra then v_cgst := v_cgst + v_gst/2; v_sgst := v_sgst + v_gst/2;
    else v_igst := v_igst + v_gst; end if;

    -- inventory IN (convert to base unit), unit_cost = landed rate per base unit
    select base_unit_id into v_base_unit from ingredients where id = (it->>'ingredient_id')::uuid;
    v_qty_base := to_base_qty((it->>'qty')::numeric, (it->>'unit_id')::uuid, v_base_unit);
    insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, unit_cost, source_table, source_id)
    values (v_org, v_branch, (it->>'ingredient_id')::uuid, 'purchase', v_qty_base,
      case when v_qty_base = 0 then 0 else v_taxable / v_qty_base end, 'purchases', v_purchase)
    returning id into v_mov;

    insert into inventory_cost_layers(org_id, branch_id, ingredient_id, qty_remaining, unit_cost, source_movement_id)
    values (v_org, v_branch, (it->>'ingredient_id')::uuid, v_qty_base,
      case when v_qty_base = 0 then 0 else v_taxable / v_qty_base end, v_mov);

    -- remember vendor price
    insert into vendor_ingredients(vendor_id, ingredient_id, last_price)
    values ((p->>'vendor_id')::uuid, (it->>'ingredient_id')::uuid, (it->>'rate')::numeric)
    on conflict (vendor_id, ingredient_id) do update set last_price = excluded.last_price;
  end loop;

  update purchases set subtotal = v_sub, cgst = v_cgst, sgst = v_sgst, igst = v_igst,
    total = v_sub + v_cgst + v_sgst + v_igst where id = v_purchase;
  return v_purchase;
end; $$;

-- ---------- Post a sale: items + recipe consumption (FIFO) + COGS + food cost ----------
create or replace function public.post_sale(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := (p->>'org_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_sale uuid; it jsonb; ri record; layer record;
  v_gross numeric := 0; v_tax numeric := 0; v_disc numeric := 0; v_net numeric := 0; v_cogs numeric := 0;
  v_recipe uuid; v_yield numeric; v_need numeric; v_need_base numeric; v_base_unit uuid;
  v_take numeric; v_line_cost numeric;
begin
  if my_role(v_org) not in ('owner','manager','accountant','staff') then raise exception 'forbidden'; end if;

  insert into sales(org_id, branch_id, sale_date, source, external_ref, channel)
  values (v_org, v_branch, coalesce((p->>'sale_date')::date, current_date),
          coalesce((p->>'source')::sale_src_t,'manual'), p->>'external_ref', p->>'channel')
  returning id into v_sale;

  for it in select * from jsonb_array_elements(p->'items') loop
    insert into sale_items(sale_id, menu_item_id, qty, rate, discount, gst_rate, line_total)
    values (v_sale, (it->>'menu_item_id')::uuid, (it->>'qty')::numeric, (it->>'rate')::numeric,
      coalesce((it->>'discount')::numeric,0), coalesce((it->>'gst_rate')::numeric,0),
      (it->>'qty')::numeric * (it->>'rate')::numeric - coalesce((it->>'discount')::numeric,0));

    v_gross := v_gross + (it->>'qty')::numeric * (it->>'rate')::numeric;
    v_disc  := v_disc + coalesce((it->>'discount')::numeric,0);
    v_tax   := v_tax + ((it->>'qty')::numeric * (it->>'rate')::numeric) * coalesce((it->>'gst_rate')::numeric,0)/100.0;

    -- find active recipe
    select id, yield_qty into v_recipe, v_yield from recipes
      where menu_item_id = (it->>'menu_item_id')::uuid and is_active and org_id = v_org
      order by version desc limit 1;
    if v_recipe is null then continue; end if;

    -- consume each ingredient component (one-level sub-recipes can be added later)
    for ri in select ingredient_id, qty, unit_id, wastage_pct from recipe_items
              where recipe_id = v_recipe and component_type = 'ingredient' and ingredient_id is not null loop
      v_need := (it->>'qty')::numeric * ri.qty * (1 + coalesce(ri.wastage_pct,0)/100.0) / nullif(v_yield,0);
      select base_unit_id into v_base_unit from ingredients where id = ri.ingredient_id;
      v_need_base := to_base_qty(v_need, ri.unit_id, v_base_unit);

      -- FIFO deplete cost layers
      for layer in select * from inventory_cost_layers
                   where org_id = v_org and branch_id = v_branch and ingredient_id = ri.ingredient_id
                     and qty_remaining > 0 order by received_at asc loop
        exit when v_need_base <= 0;
        v_take := least(layer.qty_remaining, v_need_base);
        v_line_cost := v_take * layer.unit_cost;
        v_cogs := v_cogs + v_line_cost;
        update inventory_cost_layers set qty_remaining = qty_remaining - v_take where id = layer.id;
        v_need_base := v_need_base - v_take;
      end loop;

      -- record consumption movement (negative)
      insert into inventory_movements(org_id, branch_id, ingredient_id, movement_type, qty, source_table, source_id)
      values (v_org, v_branch, ri.ingredient_id, 'consumption',
        -1 * to_base_qty(v_need, ri.unit_id, v_base_unit), 'sales', v_sale);
    end loop;
  end loop;

  v_net := v_gross - v_disc;
  update sales set gross_amount = v_gross, discount = v_disc, tax_amount = v_tax,
    net_amount = v_net, cogs = v_cogs where id = v_sale;

  return jsonb_build_object('sale_id', v_sale, 'net', v_net, 'cogs', v_cogs,
    'food_cost_pct', case when v_net = 0 then 0 else round(v_cogs / v_net * 100, 2) end);
end; $$;

-- ---------- Dashboard metrics ----------
create or replace function public.dashboard_metrics(p_org uuid, p_branch uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rev numeric; v_cogs numeric; v_purch numeric; v_exp numeric;
  v_branch_filter boolean := p_branch is not null;
begin
  if my_role(p_org) is null then raise exception 'forbidden'; end if;

  select coalesce(sum(net_amount),0), coalesce(sum(cogs),0) into v_rev, v_cogs from sales
    where org_id = p_org and sale_date between p_from and p_to
      and (not v_branch_filter or branch_id = p_branch);
  select coalesce(sum(total),0) into v_purch from purchases
    where org_id = p_org and bill_date between p_from and p_to
      and (not v_branch_filter or branch_id = p_branch);
  select coalesce(sum(amount),0) into v_exp from expenses
    where org_id = p_org and expense_date between p_from and p_to
      and (not v_branch_filter or branch_id = p_branch);

  return jsonb_build_object(
    'revenue', v_rev,
    'purchases', v_purch,
    'expenses', v_exp,
    'cogs', v_cogs,
    'food_cost_pct', case when v_rev = 0 then 0 else round(v_cogs / v_rev * 100, 2) end,
    'gross_profit', v_rev - v_cogs,
    'net_profit', v_rev - v_cogs - v_exp,
    'top_sellers', (
      select coalesce(jsonb_agg(t),'[]') from (
        select mi.name, sum(si.qty) qty, sum(si.line_total) amount
        from sale_items si join sales s on s.id = si.sale_id join menu_items mi on mi.id = si.menu_item_id
        where s.org_id = p_org and s.sale_date between p_from and p_to and (not v_branch_filter or s.branch_id = p_branch)
        group by mi.name order by amount desc limit 5) t),
    'least_sellers', (
      select coalesce(jsonb_agg(t),'[]') from (
        select mi.name, sum(si.qty) qty, sum(si.line_total) amount
        from sale_items si join sales s on s.id = si.sale_id join menu_items mi on mi.id = si.menu_item_id
        where s.org_id = p_org and s.sale_date between p_from and p_to and (not v_branch_filter or s.branch_id = p_branch)
        group by mi.name order by amount asc limit 5) t),
    'low_stock', (
      select coalesce(jsonb_agg(t),'[]') from (
        select i.name, cs.qty, i.reorder_level
        from v_current_stock cs join ingredients i on i.id = cs.ingredient_id
        where cs.org_id = p_org and (not v_branch_filter or cs.branch_id = p_branch)
          and cs.qty <= i.reorder_level and i.reorder_level > 0
        order by cs.qty asc limit 10) t),
    'daily_trend', (
      select coalesce(jsonb_agg(t order by t->>'d'),'[]') from (
        select jsonb_build_object('d', sale_date, 'revenue', sum(net_amount)) t
        from sales where org_id = p_org and sale_date between p_from and p_to
          and (not v_branch_filter or branch_id = p_branch)
        group by sale_date) t),
    'branch_perf', (
      select coalesce(jsonb_agg(t),'[]') from (
        select b.name, coalesce(sum(s.net_amount),0) revenue
        from branches b left join sales s on s.branch_id = b.id and s.sale_date between p_from and p_to
        where b.org_id = p_org group by b.name order by revenue desc) t)
  );
end; $$;
