"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

export async function addBranch(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Branch name required" };
  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert({
    org_id: ctx.orgId, name, state_code: String(formData.get("state_code") || "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return { ok: true };
}
