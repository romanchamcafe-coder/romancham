"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

type Comp = { component_id: string; qty: number };

export type RawRecipeRow = { salesItem: string; component: string; qty: string };

// Bulk import recipes from a CSV (Sales Item, Component, Qty rows). Rows are
// grouped by Sales Item; component/sales names are matched (case-insensitive)
// to existing items. Each Sales Item in the file has its recipe replaced with
// the components listed. Unknown items and zero-qty lines are skipped.
export async function importRecipes(
  rows: RawRecipeRow[],
): Promise<ActionState & { recipes?: number; lines?: number; skipped?: number }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const supabase = await createClient();

  const { data: ings } = await supabase
    .from("ingredients").select("id, name, material_type")
    .eq("org_id", ctx.orgId).eq("is_active", true);

  const salesMap = new Map<string, string>();
  const compMap = new Map<string, string>();
  for (const i of ings ?? []) {
    const key = String(i.name).trim().toLowerCase();
    if (i.material_type === "sales" || i.material_type === "both") salesMap.set(key, i.id);
    if (i.material_type === "purchase" || i.material_type === "both") compMap.set(key, i.id);
  }

  const groups = new Map<string, Comp[]>();
  let skipped = 0;
  for (const r of rows) {
    const s = (r.salesItem || "").trim();
    if (!s) continue;
    const skey = s.toLowerCase();
    if (!salesMap.has(skey)) { skipped++; continue; }
    if (!groups.has(skey)) groups.set(skey, []);
    const compName = (r.component || "").trim();
    const qty = Number(r.qty) || 0;
    if (!compName || qty <= 0) continue;
    const cid = compMap.get(compName.toLowerCase());
    if (!cid) { skipped++; continue; }
    groups.get(skey)!.push({ component_id: cid, qty });
  }

  let recipes = 0, lines = 0;
  for (const [skey, comps] of groups) {
    if (comps.length === 0) continue; // don't wipe a recipe just because names didn't match
    const salesId = salesMap.get(skey)!;
    await supabase.from("item_recipe").delete().eq("org_id", ctx.orgId).eq("sales_item_id", salesId);
    const insertRows = comps.map((c) => ({ org_id: ctx.orgId, sales_item_id: salesId, component_id: c.component_id, qty: c.qty }));
    const { error } = await supabase.from("item_recipe").insert(insertRows);
    if (error) return { error: error.message };
    recipes++;
    lines += comps.length;
  }

  revalidatePath("/recipes");
  revalidatePath("/dashboard");
  return { ok: true, recipes, lines, skipped };
}

export async function saveRecipe(salesItemId: string, components: Comp[]): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!salesItemId) return { error: "Select a sales item" };

  const rows = (components || [])
    .filter((c) => c.component_id && Number(c.qty) > 0)
    .map((c) => ({ org_id: ctx.orgId, sales_item_id: salesItemId, component_id: c.component_id, qty: Number(c.qty) }));

  const supabase = await createClient();
  await supabase.from("item_recipe").delete().eq("org_id", ctx.orgId).eq("sales_item_id", salesItemId);
  if (rows.length) {
    const { error } = await supabase.from("item_recipe").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath("/recipes");
  revalidatePath("/dashboard");
  return { ok: true };
}
