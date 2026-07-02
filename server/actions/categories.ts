"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

type CatType = "ingredient" | "expense";

async function isDuplicate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string, type: CatType, name: string, excludeId: string | null,
) {
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("org_id", orgId).eq("type", type).eq("is_active", true);
  const target = name.trim().toLowerCase();
  return (data ?? []).some((r: any) => r.id !== excludeId && String(r.name).trim().toLowerCase() === target);
}

function revalidate() {
  revalidatePath("/masters/categories");
  revalidatePath("/expenses");
}

export async function createCategory(name: string, type: CatType = "ingredient"): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const n = (name || "").trim();
  if (!n) return { error: "Name is required" };
  const supabase = await createClient();
  if (await isDuplicate(supabase, ctx.orgId, type, n, null)) return { error: `"${n}" already exists` };
  const { error } = await supabase.from("categories").insert({ org_id: ctx.orgId, name: n, type });
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateCategory(id: string, name: string, type: CatType = "ingredient"): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const n = (name || "").trim();
  if (!n) return { error: "Name is required" };
  const supabase = await createClient();
  if (await isDuplicate(supabase, ctx.orgId, type, n, id)) return { error: `"${n}" already exists` };
  const { error } = await supabase.from("categories").update({ name: n }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

export async function archiveCategory(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ is_active: false }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}
