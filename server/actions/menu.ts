"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";
import type { MenuPricing } from "@/server/queries/menu";

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
