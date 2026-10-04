"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";
import type { MenuPricing } from "@/server/queries/menu";
import { computePricing } from "@/lib/menu-pricing";
import { loadCostBook } from "@/server/queries/costing";

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
  const { data: cd, book } = await loadCostBook(ctx.orgId);

  const salesMap = new Map<string, string>();
  for (const i of cd.items) if (i.isActive && (i.materialType === "sales" || i.materialType === "both")) salesMap.set(String(i.name).trim().toLowerCase(), i.id);

  const N = (v: string) => Number(v) || 0;
  let updated = 0, skipped = 0;
  const toUpsert: Record<string, unknown>[] = [];
  const now = new Date().toISOString();
  for (const row of rows) {
    const name = (row.salesItem || "").trim();
    if (!name) continue;
    const id = salesMap.get(name.toLowerCase());
    if (!id) { skipped++; continue; }
    const recipeCost = book.unitCost(id);
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
