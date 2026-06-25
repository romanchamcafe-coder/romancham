-- ============================================================
-- Brewmetrics — optional sample data
-- HOW TO USE:
--   1) First sign up once in the app so your organization exists.
--   2) In Supabase SQL editor, find your org id:
--        select id, name from organizations;
--      and your branch id:
--        select id, name from branches;
--   3) Replace the two values below, then run this file.
-- ============================================================
do $$
declare
  v_org uuid := '00000000-0000-0000-0000-000000000000';   -- <-- your org id
  v_branch uuid := '00000000-0000-0000-0000-000000000000'; -- <-- your branch id
  u_kg uuid; u_g uuid; i_cocoa uuid; i_butter uuid; m_brownie uuid; r_brownie uuid;
begin
  -- Units (kg base, g child)
  insert into units(org_id, name, abbr, factor_to_base) values (v_org,'Kilogram','kg',1000) returning id into u_kg;
  insert into units(org_id, name, abbr, base_unit_id, factor_to_base) values (v_org,'Gram','g',u_kg,1) returning id into u_g;

  -- Ingredients (base unit = gram)
  insert into ingredients(org_id, name, base_unit_id, default_gst_rate, reorder_level)
    values (v_org,'Cocoa Powder',u_g,5,2000) returning id into i_cocoa;
  insert into ingredients(org_id, name, base_unit_id, default_gst_rate, reorder_level)
    values (v_org,'Butter',u_g,12,3000) returning id into i_butter;

  -- Menu item + recipe (yields 12 brownies)
  insert into menu_items(org_id, name, selling_price, gst_rate)
    values (v_org,'Chocolate Brownie',180,5) returning id into m_brownie;
  insert into recipes(org_id, menu_item_id, yield_qty, yield_unit_id)
    values (v_org, m_brownie, 12, u_g) returning id into r_brownie;
  insert into recipe_items(recipe_id, component_type, ingredient_id, qty, unit_id, wastage_pct)
    values (r_brownie,'ingredient',i_cocoa, 960, u_g, 2),   -- 80g/pc * 12
           (r_brownie,'ingredient',i_butter,1440, u_g, 0);  -- 120g/pc * 12

  -- A sample purchase (adds stock + FIFO layers + GST)
  perform post_purchase(jsonb_build_object(
    'org_id', v_org, 'branch_id', v_branch, 'bill_no','SAMPLE-001',
    'items', jsonb_build_array(
      jsonb_build_object('ingredient_id', i_cocoa, 'qty', 10, 'unit_id', u_kg, 'rate', 450, 'gst_rate', 5),
      jsonb_build_object('ingredient_id', i_butter,'qty', 6,  'unit_id', u_kg, 'rate', 520, 'gst_rate', 12)
    )));

  -- A sample sale (consumes inventory via recipe, computes COGS + food cost)
  perform post_sale(jsonb_build_object(
    'org_id', v_org, 'branch_id', v_branch,
    'items', jsonb_build_array(
      jsonb_build_object('menu_item_id', m_brownie, 'qty', 24, 'rate', 180, 'gst_rate', 5)
    )));
end $$;
