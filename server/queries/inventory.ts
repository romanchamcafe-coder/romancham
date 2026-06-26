import { createClient } from "@/lib/supabase/server";

export async function getInventory(orgId: string, branchId: string | null) {
  const supabase = await createClient();
  const ingQ = supabase.from("ingredients")
    .select("id, name, category_id, base_unit_id, reorder_level")
    .eq("org_id", orgId).eq("is_active", true).in("material_type", ["purchase", "both"]).order("name");
  let stockQ = supabase.from("v_current_stock").select("ingredient_id, qty").eq("org_id", orgId);
  if (branchId) stockQ = stockQ.eq("branch_id", branchId);
  let layerQ = supabase.from("inventory_cost_layers").select("ingredient_id, qty_remaining, unit_cost").eq("org_id", orgId);
  if (branchId) layerQ = layerQ.eq("branch_id", branchId);
  const catQ = supabase.from("categories").select("id, name").eq("org_id", orgId);
  const unitQ = supabase.from("units").select("id, abbr").eq("org_id", orgId);

  const [{ data: ings }, { data: stock }, { data: layers }, { data: cats }, { data: units }] =
    await Promise.all([ingQ, stockQ, layerQ, catQ, unitQ]);

  const qtyMap = new Map<string, number>();
  for (const s of stock ?? []) qtyMap.set(s.ingredient_id, Number(s.qty) || 0);
  const valMap = new Map<string, number>();
  for (const l of layers ?? []) valMap.set(l.ingredient_id, (valMap.get(l.ingredient_id) || 0) + Number(l.qty_remaining) * Number(l.unit_cost));
  const cat = new Map((cats ?? []).map((c) => [c.id, c.name]));
  const uni = new Map((units ?? []).map((u) => [u.id, u.abbr]));

  return (ings ?? []).map((i: any) => {
    const qty = qtyMap.get(i.id) ?? 0;
    const reorder = Number(i.reorder_level) || 0;
    const status = qty <= 0 ? "out" : reorder > 0 && qty <= reorder ? "low" : "ok";
    return {
      id: i.id, name: i.name,
      category: i.category_id ? cat.get(i.category_id) ?? "—" : "—",
      uom: i.base_unit_id ? uni.get(i.base_unit_id) ?? "" : "",
      qty, value: valMap.get(i.id) ?? 0, reorder, status,
    };
  });
}

export async function getAdjustItems(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("ingredients").select("id, name")
    .eq("org_id", orgId).eq("is_active", true).in("material_type", ["purchase", "both"]).order("name");
  return data ?? [];
}
