import { createClient } from "@/lib/supabase/server";
import { loadCostBook } from "@/server/queries/costing";

export type MenuPricing = {
  packaging_cost: number; wastage_pct: number; labor_cost: number; utility_cost: number;
  overhead_cost: number; marketing_cost: number; commission_pct: number;
  target_profit_pct: number; gst_pct: number;
  dine_price: number; takeaway_price: number; delivery_price: number;
};

export type MenuItem = {
  id: string; name: string; recipeCost: number; hasRecipe: boolean; pricing: MenuPricing | null;
};

// Food cost per portion comes from the single costing engine (raw → prep → dish).
export async function getMenuEngineering(orgId: string): Promise<MenuItem[]> {
  const supabase = await createClient();
  const [{ data, book }, { data: pricing }] = await Promise.all([
    loadCostBook(orgId),
    supabase.from("menu_pricing").select("*").eq("org_id", orgId),
  ]);

  const priceMap = new Map<string, any>();
  for (const p of pricing ?? []) priceMap.set(p.sales_item_id, p);
  const num = (v: any) => Number(v) || 0;

  return data.items
    .filter((i) => i.isActive && (i.materialType === "sales" || i.materialType === "both"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => {
      const p = priceMap.get(s.id);
      const pricing: MenuPricing | null = p ? {
        packaging_cost: num(p.packaging_cost), wastage_pct: num(p.wastage_pct), labor_cost: num(p.labor_cost),
        utility_cost: num(p.utility_cost), overhead_cost: num(p.overhead_cost), marketing_cost: num(p.marketing_cost),
        commission_pct: num(p.commission_pct), target_profit_pct: num(p.target_profit_pct), gst_pct: num(p.gst_pct),
        dine_price: num(p.dine_price), takeaway_price: num(p.takeaway_price), delivery_price: num(p.delivery_price),
      } : null;
      return { id: s.id, name: s.name, recipeCost: book.unitCost(s.id), hasRecipe: book.lines(s.id).length > 0, pricing };
    });
}
