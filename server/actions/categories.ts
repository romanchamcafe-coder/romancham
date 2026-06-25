"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

export async function createCategory(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name required" };
  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({ org_id: ctx.orgId, name, type: "ingredient" });
  if (error) return { error: error.message };
  revalidatePath("/masters/categories");
  return { ok: true };
}
