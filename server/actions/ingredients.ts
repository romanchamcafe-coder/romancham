"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

const orNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

export async function createIngredient(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Material name required" };

  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").insert({
    org_id: ctx.orgId,
    name,
    category_id: orNull(formData.get("category_id")),
    base_unit_id: orNull(formData.get("base_unit_id")),
    default_vendor_id: orNull(formData.get("default_vendor_id")),
    hsn_code: orNull(formData.get("hsn_code")),
    default_gst_rate: Number(formData.get("default_gst_rate")) || 0,
    reorder_level: Number(formData.get("reorder_level")) || 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/masters/ingredients");
  return { ok: true };
}
