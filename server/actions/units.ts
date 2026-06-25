"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

export async function createUnit(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const name = String(formData.get("name") || "").trim();
  const abbr = String(formData.get("abbr") || "").trim();
  if (!name || !abbr) return { error: "Name and abbreviation required" };
  const supabase = await createClient();
  const { error } = await supabase.from("units").insert({ org_id: ctx.orgId, name, abbr, factor_to_base: 1 });
  if (error) return { error: error.message };
  revalidatePath("/masters/units");
  return { ok: true };
}
