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

  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").insert({
    org_id: ctx.orgId, name, material_type,
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
};

export async function updateIngredient(id: string, input: IngredientInput): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const name = (input.name || "").trim();
  if (!name) return { error: "Item name is required" };
  if (!input.base_unit_id) return { error: "Please select a Unit of Measure (UOM)" };
  const mt = ["purchase", "sales", "both"].includes(input.material_type) ? input.material_type : "purchase";

  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").update({
    name, material_type: mt,
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
