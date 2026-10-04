import { createClient } from "@/lib/supabase/server";
import { loadCostBook, type CostData } from "@/server/queries/costing";

// Legacy shape used by the CSV export (RecipesIO). Cost now comes from the engine.
export async function getRecipeData(orgId: string) {
  const { data, book } = await loadCostBook(orgId);
  const active = data.items.filter((i) => i.isActive);
  const salesItems = active.filter((i) => i.materialType === "sales" || i.materialType === "both").map((i) => ({ id: i.id, name: i.name }));
  const purchaseItems = active.filter((i) => i.materialType === "purchase" || i.materialType === "both").map((i) => ({ id: i.id, name: i.name }));
  const nameMap = new Map(data.items.map((i) => [i.id, i.name]));
  const recipeList = salesItems.map((s) => {
    const comps = book.lines(s.id).map((l) => ({ component_id: l.componentId, name: nameMap.get(l.componentId) ?? "—", qty: l.qty, cost: book.unitCost(l.componentId) }));
    return { id: s.id, name: s.name, components: comps, cost: book.unitCost(s.id) };
  });
  return { salesItems, purchaseItems, recipeList };
}

export type DishPrice = { dinePrice: number; gstPct: number };

// Everything the Recipes workspace needs (serialisable → the client builds the
// same CostBook for live what-if editing before saving).
export async function getRecipeWorkspace(orgId: string): Promise<{ data: CostData; prices: Record<string, DishPrice>; categories: { id: string; name: string }[] }> {
  const supabase = await createClient();
  const [{ data }, { data: pricing }, { data: cats }] = await Promise.all([
    loadCostBook(orgId),
    supabase.from("menu_pricing").select("sales_item_id, dine_price, gst_pct").eq("org_id", orgId),
    supabase.from("categories").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
  ]);
  const prices: Record<string, DishPrice> = {};
  for (const p of pricing ?? []) prices[p.sales_item_id] = { dinePrice: Number(p.dine_price) || 0, gstPct: Number(p.gst_pct) || 0 };
  return { data, prices, categories: cats ?? [] };
}
