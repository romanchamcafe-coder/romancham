import { createClient } from "@/lib/supabase/server";
import { CostBook, type CostItem, type CostUnit, type RecipeHeader, type RecipeLine, type ItemKind } from "@/lib/costing";

// Loads everything the costing engine needs for an org (one round-trip set)
// and returns a ready CostBook. Every screen that shows a recipe / food cost
// uses this — there is no other place that computes recipe cost.

export type CostData = {
  items: (CostItem & { materialType: string; categoryId: string | null; isActive: boolean })[];
  units: CostUnit[];
  headers: RecipeHeader[];
  lines: RecipeLine[];
};

export async function loadCostData(orgId: string): Promise<CostData> {
  const supabase = await createClient();
  const [{ data: ings }, { data: units }, { data: heads }, { data: recs }, { data: layers }, { data: vi }] = await Promise.all([
    supabase.from("ingredients").select("id, name, material_type, base_unit_id, category_id, yield_pct, is_active").eq("org_id", orgId),
    supabase.from("units").select("id, name, abbr, factor_to_base").eq("org_id", orgId).order("name"),
    supabase.from("recipe_header").select("item_id, recipe_type, yield_qty, notes, shelf_life_days").eq("org_id", orgId),
    supabase.from("item_recipe").select("sales_item_id, component_id, qty, entry_qty, entry_unit_id, sort_order").eq("org_id", orgId),
    supabase.from("inventory_cost_layers").select("ingredient_id, unit_cost, received_at").eq("org_id", orgId).order("received_at", { ascending: false }).limit(20000),
    supabase.from("vendor_ingredients").select("ingredient_id, last_price"),
  ]);

  // Raw purchase cost per base unit: latest FIFO cost layer, else vendor's last price.
  const cost = new Map<string, number>();
  for (const l of layers ?? []) if (!cost.has(l.ingredient_id)) cost.set(l.ingredient_id, Number(l.unit_cost) || 0);
  for (const v of vi ?? []) if (!cost.has(v.ingredient_id) && v.last_price != null) cost.set(v.ingredient_id, Number(v.last_price));

  const headers: RecipeHeader[] = (heads ?? []).map((h: any) => ({
    itemId: h.item_id, type: h.recipe_type === "prep" ? "prep" : "dish", yieldQty: Number(h.yield_qty) || 1,
    notes: h.notes, shelfLifeDays: h.shelf_life_days,
  }));
  const headBy = new Map(headers.map((h) => [h.itemId, h]));

  const items = (ings ?? []).map((i: any) => {
    const kind: ItemKind = i.material_type === "prep" || headBy.get(i.id)?.type === "prep" ? "prep"
      : i.material_type === "sales" ? "dish" : "raw";
    return {
      id: i.id, name: i.name, kind, baseUnitId: i.base_unit_id, purchaseUnitCost: cost.get(i.id) ?? 0,
      yieldPct: i.yield_pct == null ? 100 : Number(i.yield_pct),
      materialType: i.material_type, categoryId: i.category_id, isActive: i.is_active !== false,
    };
  });

  const lines: RecipeLine[] = (recs ?? []).map((r: any) => ({
    parentId: r.sales_item_id, componentId: r.component_id, qty: Number(r.qty) || 0,
    entryQty: r.entry_qty == null ? null : Number(r.entry_qty), entryUnitId: r.entry_unit_id, sortOrder: r.sort_order ?? 0,
  }));

  return { items, units: (units ?? []).map((u: any) => ({ id: u.id, abbr: u.abbr, name: u.name, factor_to_base: Number(u.factor_to_base) || 1 })), headers, lines };
}

export async function loadCostBook(orgId: string) {
  const data = await loadCostData(orgId);
  return { data, book: new CostBook(data) };
}
