"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { vendorSchema } from "@/lib/validators/vendor";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

export async function createVendor(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const parsed = vendorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("vendors").insert({ ...parsed.data, org_id: ctx.orgId });
  if (error) return { error: error.message };
  revalidatePath("/masters/vendors");
  return { ok: true };
}

export async function deleteVendor(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("vendors").delete().eq("id", id);
  revalidatePath("/masters/vendors");
}
