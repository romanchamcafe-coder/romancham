"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

const orNull = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };

export async function createIngredient(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Item name required" };
  const mt = String(formData.get("material_type") || "purchase");
  const material_type = ["purchase", "sales", "both"].includes(mt) ? mt : "purchase";
  const ff = String(formData.get("fulfillment") || "direct");
  const fulfillment = ff === "stock" ? "stock" : "direct";

  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").insert({
    org_id: ctx.orgId, name, material_type, fulfillment,
    category_id: orNull(formData.get("category_id")),
    base_unit_id: orNull(formData.get("base_unit_id")),
    default_vendor_id: orNull(formData.get("default_vendor_id")),
    hsn_code: orNull(formData.get("hsn_code")),
    default_gst_rate: Number(formData.get("default_gst_rate")) || 0,
    reorder_level: Number(formData.get("reorder_level")) || 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/masters/ingredients");
  revalidatePath("/purchases/new");
  return { ok: true };
}

export type RawIngredientRow = {
  name: string; type?: string; category?: string; unit?: string;
  gst?: string; reorder?: string; hsn?: string; vendor?: string;
};

// Bulk-add ingredients from a CSV. Category / Unit / Vendor are matched by
// name (case-insensitive) to existing masters — unknown ones are left blank.
// Skips blanks and names that already exist. Returns how many were added.
export async function importIngredients(
  rows: RawIngredientRow[],
): Promise<ActionState & { added?: number; skipped?: number }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const supabase = await createClient();

  const [{ data: cats }, { data: units }, { data: vendors }, { data: existing }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("org_id", ctx.orgId).eq("type", "ingredient").eq("is_active", true),
    supabase.from("units").select("id, name, abbr").eq("org_id", ctx.orgId).eq("is_active", true),
    supabase.from("vendors").select("id, name").eq("org_id", ctx.orgId).eq("is_active", true),
    supabase.from("ingredients").select("name").eq("org_id", ctx.orgId).eq("is_active", true),
  ]);

  const catMap = new Map((cats ?? []).map((c: any) => [String(c.name).trim().toLowerCase(), c.id]));
  const unitMap = new Map<string, string>();
  for (const u of units ?? []) {
    if (u.abbr) unitMap.set(String(u.abbr).trim().toLowerCase(), u.id);
    if (u.name) unitMap.set(String(u.name).trim().toLowerCase(), u.id);
  }
  const venMap = new Map((vendors ?? []).map((v: any) => [String(v.name).trim().toLowerCase(), v.id]));
  const have = new Set((existing ?? []).map((i: any) => String(i.name).trim().toLowerCase()));

  const seen = new Set<string>();
  const toAdd: Record<string, unknown>[] = [];
  for (const r of rows) {
    const name = (r.name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (have.has(key) || seen.has(key)) continue;
    seen.add(key);
    const t = (r.type || "").trim().toLowerCase();
    const material_type = ["purchase", "sales", "both"].includes(t) ? t : "purchase";
    toAdd.push({
      org_id: ctx.orgId, name, material_type, fulfillment: "direct",
      category_id: r.category ? (catMap.get(r.category.trim().toLowerCase()) ?? null) : null,
      base_unit_id: r.unit ? (unitMap.get(r.unit.trim().toLowerCase()) ?? null) : null,
      default_vendor_id: r.vendor ? (venMap.get(r.vendor.trim().toLowerCase()) ?? null) : null,
      hsn_code: (r.hsn || "").trim() || null,
      default_gst_rate: Number(r.gst) || 0,
      reorder_level: Number(r.reorder) || 0,
    });
  }

  const skipped = rows.filter((r) => (r.name || "").trim()).length - toAdd.length;
  if (toAdd.length === 0) return { ok: true, added: 0, skipped };

  const { error } = await supabase.from("ingredients").insert(toAdd);
  if (error) return { error: error.message };
  revalidatePath("/masters/ingredients");
  revalidatePath("/purchases/new");
  return { ok: true, added: toAdd.length, skipped };
}

export async function deactivateIngredient(formData: FormData): Promise<void> {
  const ctx = await getActiveContext();
  const id = String(formData.get("id") || "");
  if (!ctx?.orgId || !id) return;
  const supabase = await createClient();
  await supabase.from("ingredients").update({ is_active: false }).eq("id", id).eq("org_id", ctx.orgId);
  revalidatePath("/masters/ingredients");
}

export type IngredientInput = {
  name: string; material_type: string; category_id: string; base_unit_id: string;
  default_vendor_id: string; default_gst_rate: string; reorder_level: string; hsn_code: string;
  fulfillment: string;
};

export async function updateIngredient(id: string, input: IngredientInput): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const name = (input.name || "").trim();
  if (!name) return { error: "Item name is required" };
  if (!input.base_unit_id) return { error: "Please select a Unit of Measure (UOM)" };
  const mt = ["purchase", "sales", "both"].includes(input.material_type) ? input.material_type : "purchase";
  const fulfillment = input.fulfillment === "stock" ? "stock" : "direct";

  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").update({
    name, material_type: mt, fulfillment,
    category_id: input.category_id || null,
    base_unit_id: input.base_unit_id || null,
    default_vendor_id: input.default_vendor_id || null,
    hsn_code: (input.hsn_code || "").trim() || null,
    default_gst_rate: Number(input.default_gst_rate) || 0,
    reorder_level: Number(input.reorder_level) || 0,
  }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/masters/ingredients");
  revalidatePath("/purchases/new");
  return { ok: true };
}

export async function removeIngredient(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !id) return { error: "No active organization" };
  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").update({ is_active: false }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/masters/ingredients");
  revalidatePath("/purchases/new");
  return { ok: true };
}

// Phase 13 — Data safety: soft-deleted ingredients can be restored (undo delete).
export async function restoreIngredient(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !id) return { error: "No active organization" };
  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").update({ is_active: true }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/masters/ingredients");
  revalidatePath("/purchases/new");
  return { ok: true };
}
