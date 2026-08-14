"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";
import type { MenuPricing } from "@/server/queries/menu";
import { computePricing } from "@/lib/menu-pricing";

export async function saveMenuPricing(salesItemId: string, p: MenuPricing): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!salesItemId) return { error: "Select a sales item" };
  const n = (v: number) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const supabase = await createClient();
  const { error } = await supabase.from("menu_pricing").upsert({
    org_id: ctx.orgId,
    sales_item_id: salesItemId,
    packaging_cost: n(p.packaging_cost), wastage_pct: n(p.wastage_pct), labor_cost: n(p.labor_cost),
    utility_cost: n(p.utility_cost), overhead_cost: n(p.overhead_cost), marketing_cost: n(p.marketing_cost),
    commission_pct: n(p.commission_pct), target_profit_pct: n(p.target_profit_pct), gst_pct: n(p.gst_pct),
    dine_price: n(p.dine_price), takeaway_price: n(p.takeaway_price), delivery_price: n(p.delivery_price),
    updated_at: new Date().toISOString(),
  }, { onConflict: "org_id,sales_item_id" });

  if (error) return { error: error.message };
  revalidatePath("/menu-engineering");
  return { ok: true };
}

export type RawMenuRow = {
  salesItem: string; packaging: string; wastage: string; labor: string; utility: string;
  overhead: string; marketing: string; commission: string; targetProfit: string; gst: string;
};

// Bulk import menu pricing. Matches Sales Item by name, recomputes the derived
// dine-in/takeaway/delivery prices from the live recipe cost + the imported
// inputs, and upserts. Unknown item names are skipped.
export async function importMenuPricing(
  rows: RawMenuRow[],
): Promise<ActionState & { updated?: number; skipped?: number }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const supabase = await createClient();

  const [{ data: ings }, { data: recipes }, { data: layers }, { data: vi }] = await Promise.all([
    supabase.from("ingredients").select("id, name, material_type").eq("org_id", ctx.orgId).eq("is_active", true),
    supabase.from("item_recipe").select("sales_item_id, component_id, qty").eq("org_id", ctx.orgId),
    supabase.from("inventory_cost_layers").select("ingredient_id, unit_cost, received_at").eq("org_id", ctx.orgId).order("received_at", { ascending: false }),
    supabase.from("vendor_ingredients").select("ingredient_id, last_price"),
  ]);

  const salesMap = new Map<string, string>();
  for (const i of ings ?? []) if (i.material_type === "sales" || i.material_type === "both") salesMap.set(String(i.name).trim().toLowerCase(), i.id);

  const costMap = new Map<string, number>();
  for (const l of layers ?? []) if (!costMap.has(l.ingredient_id)) costMap.set(l.ingredient_id, Number(l.unit_cost) || 0);
  for (const v of vi ?? []) if (!costMap.has(v.ingredient_id) && v.last_price != null) costMap.set(v.ingredient_id, Number(v.last_price));

  const recipeCostBy = new Map<string, number>();
  for (const r of recipes ?? []) recipeCostBy.set(r.sales_item_id, (recipeCostBy.get(r.sales_item_id) || 0) + Number(r.qty) * (costMap.get(r.component_id) ?? 0));

  const N = (v: string) => Number(v) || 0;
  let updated = 0, skipped = 0;
  const toUpsert: Record<string, unknown>[] = [];
  const now = new Date().toISOString();
  for (const row of rows) {
    const name = (row.salesItem || "").trim();
    if (!name) continue;
    const id = salesMap.get(name.toLowerCase());
    if (!id) { skipped++; continue; }
    const recipeCost = recipeCostBy.get(id) ?? 0;
    const r = computePricing({
      recipeCost, packaging: N(row.packaging), wastage: N(row.wastage), labor: N(row.labor),
      utility: N(row.utility), overhead: N(row.overhead), marketing: N(row.marketing),
      commission: N(row.commission), targetProfit: N(row.targetProfit), gst: N(row.gst),
    });
    toUpsert.push({
      org_id: ctx.orgId, sales_item_id: id,
      packaging_cost: N(row.packaging), wastage_pct: N(row.wastage), labor_cost: N(row.labor),
      utility_cost: N(row.utility), overhead_cost: N(row.overhead), marketing_cost: N(row.marketing),
      commission_pct: N(row.commission), target_profit_pct: N(row.targetProfit), gst_pct: N(row.gst),
      dine_price: Math.round(r.dinePrice * 100) / 100, takeaway_price: Math.round(r.takeawayPrice * 100) / 100,
      delivery_price: Math.round(r.deliveryPrice * 100) / 100, updated_at: now,
    });
    updated++;
  }

  if (toUpsert.length === 0) return { ok: true, updated: 0, skipped };
  const { error: upErr } = await supabase.from("menu_pricing").upsert(toUpsert, { onConflict: "org_id,sales_item_id" });
  if (upErr) return { error: upErr.message };
  revalidatePath("/menu-engineering");
  return { ok: true, updated, skipped };
}
