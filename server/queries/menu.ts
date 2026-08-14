import { createClient } from "@/lib/supabase/server";

export type MenuPricing = {
  packaging_cost: number; wastage_pct: number; labor_cost: number; utility_cost: number;
  overhead_cost: number; marketing_cost: number; commission_pct: number;
  target_profit_pct: number; gst_pct: number;
  dine_price: number; takeaway_price: number; delivery_price: number;
};

export type MenuItem = {
  id: string; name: string; recipeCost: number; hasRecipe: boolean; pricing: MenuPricing | null;
};

export async function getMenuEngineering(orgId: string): Promise<MenuItem[]> {
  const supabase = await createClient();
  const [{ data: ings }, { data: recipes }, { data: layers }, { data: vi }, { data: pricing }] = await Promise.all([
    supabase.from("ingredients").select("id, name, material_type").eq("org_id", orgId).eq("is_active", true).order("name"),
    supabase.from("item_recipe").select("sales_item_id, component_id, qty").eq("org_id", orgId),
    supabase.from("inventory_cost_layers").select("ingredient_id, unit_cost, received_at").eq("org_id", orgId).order("received_at", { ascending: false }),
    supabase.from("vendor_ingredients").select("ingredient_id, last_price"),
    supabase.from("menu_pricing").select("*").eq("org_id", orgId),
  ]);

  const costMap = new Map<string, number>();
  for (const l of layers ?? []) if (!costMap.has(l.ingredient_id)) costMap.set(l.ingredient_id, Number(l.unit_cost) || 0);
  for (const v of vi ?? []) if (!costMap.has(v.ingredient_id) && v.last_price != null) costMap.set(v.ingredient_id, Number(v.last_price));

  const bySales = new Map<string, { component_id: string; qty: number }[]>();
  for (const r of recipes ?? []) {
    const arr = bySales.get(r.sales_item_id) ?? [];
    arr.push({ component_id: r.component_id, qty: Number(r.qty) });
    bySales.set(r.sales_item_id, arr);
  }

  const priceMap = new Map<string, any>();
  for (const p of pricing ?? []) priceMap.set(p.sales_item_id, p);

  const num = (v: any) => Number(v) || 0;
  const salesItems = (ings ?? []).filter((i) => i.material_type === "sales" || i.material_type === "both");

  return salesItems.map((s) => {
    const comps = bySales.get(s.id) ?? [];
    const recipeCost = comps.reduce((sum, c) => sum + c.qty * (costMap.get(c.component_id) ?? 0), 0);
    const p = priceMap.get(s.id);
    const pricing: MenuPricing | null = p ? {
      packaging_cost: num(p.packaging_cost), wastage_pct: num(p.wastage_pct), labor_cost: num(p.labor_cost),
      utility_cost: num(p.utility_cost), overhead_cost: num(p.overhead_cost), marketing_cost: num(p.marketing_cost),
      commission_pct: num(p.commission_pct), target_profit_pct: num(p.target_profit_pct), gst_pct: num(p.gst_pct),
      dine_price: num(p.dine_price), takeaway_price: num(p.takeaway_price), delivery_price: num(p.delivery_price),
    } : null;
    return { id: s.id, name: s.name, recipeCost, hasRecipe: comps.length > 0, pricing };
  });
}
