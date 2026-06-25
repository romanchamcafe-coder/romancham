"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { ingredientSchema } from "@/lib/validators/ingredient";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

export async function createIngredient(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const parsed = ingredientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").insert({ ...parsed.data, org_id: ctx.orgId });
  if (error) return { error: error.message };
  revalidatePath("/masters/ingredients");
  return { ok: true };
}

export async function deleteIngredient(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("ingredients").delete().eq("id", id);
  revalidatePath("/masters/ingredients");
}
