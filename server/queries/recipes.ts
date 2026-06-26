import { createClient } from "@/lib/supabase/server";

export async function getRecipeData(orgId: string) {
  const supabase = await createClient();
  const [{ data: ings }, { data: recipes }, { data: layers }, { data: vi }] = await Promise.all([
    supabase.from("ingredients").select("id, name, material_type")
      .eq("org_id", orgId).eq("is_active", true).order("name"),
    supabase.from("item_recipe").select("sales_item_id, component_id, qty").eq("org_id", orgId),
    supabase.from("inventory_cost_layers").select("ingredient_id, unit_cost, received_at").eq("org_id", orgId).order("received_at", { ascending: false }),
    supabase.from("vendor_ingredients").select("ingredient_id, last_price"),
  ]);

  const salesItems = (ings ?? []).filter((i) => i.material_type === "sales" || i.material_type === "both").map((i) => ({ id: i.id, name: i.name }));
  const purchaseItems = (ings ?? []).filter((i) => i.material_type === "purchase" || i.material_type === "both").map((i) => ({ id: i.id, name: i.name }));
  const nameMap = new Map((ings ?? []).map((i) => [i.id, i.name]));

  // latest unit cost per component
  const costMap = new Map<string, number>();
  for (const l of layers ?? []) if (!costMap.has(l.ingredient_id)) costMap.set(l.ingredient_id, Number(l.unit_cost) || 0);
  for (const v of vi ?? []) if (!costMap.has(v.ingredient_id) && v.last_price != null) costMap.set(v.ingredient_id, Number(v.last_price));

  // components grouped by sales item
  const bySales = new Map<string, { component_id: string; qty: number }[]>();
  for (const r of recipes ?? []) {
    const arr = bySales.get(r.sales_item_id) ?? [];
    arr.push({ component_id: r.component_id, qty: Number(r.qty) });
    bySales.set(r.sales_item_id, arr);
  }

  const recipeList = salesItems.map((s) => {
    const comps = (bySales.get(s.id) ?? []).map((c) => ({
      component_id: c.component_id, name: nameMap.get(c.component_id) ?? "—", qty: c.qty, cost: costMap.get(c.component_id) ?? 0,
    }));
    const total = comps.reduce((sum, c) => sum + c.qty * c.cost, 0);
    return { id: s.id, name: s.name, components: comps, cost: total };
  });

  return { salesItems, purchaseItems, costMap: Object.fromEntries(costMap), recipeList };
}
