"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { loadCostData } from "@/server/queries/costing";
import { findCycle, normaliseLines, type EntryLine } from "@/lib/costing";
import type { ActionState } from "@/lib/types";

const touch = () => { revalidatePath("/recipes"); revalidatePath("/menu-engineering"); revalidatePath("/dashboard"); };

type Comp = { component_id: string; qty: number };
export type RawRecipeRow = { salesItem: string; component: string; qty: string };

// Bulk import FINAL-DISH recipes from CSV (Sales Item, Component, Qty per portion
// in the component's base unit). Matching is by name, case-insensitive.
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
    if (i.material_type === "purchase" || i.material_type === "both" || i.material_type === "prep") compMap.set(key, i.id);
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
    if (comps.length === 0) continue;
    const salesId = salesMap.get(skey)!;
    await supabase.from("item_recipe").delete().eq("org_id", ctx.orgId).eq("sales_item_id", salesId);
    const insertRows = comps.map((c, i) => ({ org_id: ctx.orgId, sales_item_id: salesId, component_id: c.component_id, qty: c.qty, entry_qty: c.qty, sort_order: i }));
    const { error } = await supabase.from("item_recipe").insert(insertRows);
    if (error) return { error: error.message };
    await supabase.from("recipe_header").upsert({ item_id: salesId, org_id: ctx.orgId, recipe_type: "dish", yield_qty: 1, updated_at: new Date().toISOString() }, { onConflict: "item_id" });
    recipes++;
    lines += comps.length;
  }
  touch();
  return { ok: true, recipes, lines, skipped };
}

// ---------- Prep / Component items ----------
export async function createPrep(input: { name: string; unitId: string; categoryId?: string }): Promise<ActionState & { id?: string }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const name = (input.name || "").trim();
  if (!name) return { error: "Give the prep a name" };
  if (!input.unitId) return { error: "Choose the unit the prep is measured in (usually gms or ml)" };
  const supabase = await createClient();
  const { data: dup } = await supabase.from("ingredients").select("id").eq("org_id", ctx.orgId).eq("is_active", true).ilike("name", name).limit(1);
  if (dup?.length) return { error: `"${name}" already exists — pick it from the list instead` };
  const { data, error } = await supabase.from("ingredients").insert({
    org_id: ctx.orgId, name, material_type: "prep", fulfillment: "direct", base_unit_id: input.unitId,
    category_id: input.categoryId || null, default_gst_rate: 0, reorder_level: 0,
  }).select("id").single();
  if (error) return { error: error.message };
  touch(); revalidatePath("/masters/ingredients");
  return { ok: true, id: data.id };
}

export type SaveRecipeInput = {
  itemId: string;
  type: "prep" | "dish";
  yieldQty: number;               // prep: final usable yield in the prep's unit; dish: portions the recipe makes
  notes?: string; shelfLifeDays?: number | null; storage?: string;
  lines: EntryLine[];
};

export async function saveRecipeV2(input: SaveRecipeInput): Promise<ActionState & { lineErrors?: { index: number; message: string }[] }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!input.itemId) return { error: input.type === "prep" ? "Select or create a prep" : "Select a dish" };
  const yieldQty = Number(input.yieldQty);
  if (!(yieldQty > 0)) return { error: input.type === "prep" ? "Enter the FINAL yield of the batch (must be more than 0)" : "Portions must be more than 0" };

  const data = await loadCostData(ctx.orgId);
  const items = new Map(data.items.map((i) => [i.id, i]));
  const units = new Map(data.units.map((u) => [u.id, u]));
  if (!items.has(input.itemId)) return { error: "Item not found" };

  const { lines, errors } = normaliseLines(input.itemId, yieldQty, input.lines || [], items, units);
  if (errors.length) return { error: errors[0].index >= 0 ? `Line ${errors[0].index + 1}: ${errors[0].message}` : errors[0].message, lineErrors: errors };
  if (lines.length === 0) return { error: "Add at least one ingredient or prep with a quantity" };
  const ids = lines.map((l) => l.componentId);
  if (new Set(ids).size !== ids.length) return { error: "The same item is listed twice — combine it into one line" };

  const cycle = findCycle(input.itemId, ids, data.lines, (id) => items.get(id)?.name ?? id);
  if (cycle) return { error: `Circular recipe: ${cycle.join(" → ")}. A recipe can't (directly or indirectly) contain itself.` };

  const supabase = await createClient();
  const { error: hErr } = await supabase.from("recipe_header").upsert({
    item_id: input.itemId, org_id: ctx.orgId, recipe_type: input.type, yield_qty: yieldQty,
    notes: (input.notes || "").trim() || null,
    shelf_life_days: input.shelfLifeDays && input.shelfLifeDays > 0 ? Math.round(input.shelfLifeDays) : null,
    storage: (input.storage || "").trim() || null,
    updated_by: ctx.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "item_id" });
  if (hErr) return { error: hErr.message };

  const { error: dErr } = await supabase.from("item_recipe").delete().eq("org_id", ctx.orgId).eq("sales_item_id", input.itemId);
  if (dErr) return { error: dErr.message };
  const { error: iErr } = await supabase.from("item_recipe").insert(lines.map((l) => ({
    org_id: ctx.orgId, sales_item_id: input.itemId, component_id: l.componentId, qty: l.qty,
    entry_qty: l.entryQty, entry_unit_id: l.entryUnitId, sort_order: l.sortOrder ?? 0,
  })));
  if (iErr) return { error: iErr.message };
  touch();
  return { ok: true };
}

export async function clearRecipe(itemId: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const supabase = await createClient();
  const { count } = await supabase.from("item_recipe").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("component_id", itemId);
  if ((count ?? 0) > 0) return { error: "This prep is used in other recipes — remove it from them first" };
  await supabase.from("item_recipe").delete().eq("org_id", ctx.orgId).eq("sales_item_id", itemId);
  await supabase.from("recipe_header").delete().eq("org_id", ctx.orgId).eq("item_id", itemId);
  touch();
  return { ok: true };
}
