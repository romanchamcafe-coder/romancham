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

// Bulk-add categories from a pasted/uploaded list. Skips blanks and anything
// that already exists (case-insensitive), and de-dupes within the batch.
export async function importCategories(
  names: string[], type: CatType = "ingredient",
): Promise<ActionState & { added?: number; skipped?: number }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("categories").select("name")
    .eq("org_id", ctx.orgId).eq("type", type).eq("is_active", true);
  const have = new Set((existing ?? []).map((r: any) => String(r.name).trim().toLowerCase()));

  const seen = new Set<string>();
  const toAdd: { org_id: string; name: string; type: CatType }[] = [];
  for (const raw of names) {
    const n = (raw || "").trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (have.has(key) || seen.has(key)) continue;
    seen.add(key);
    toAdd.push({ org_id: ctx.orgId, name: n, type });
  }

  const skipped = names.filter((r) => (r || "").trim()).length - toAdd.length;
  if (toAdd.length === 0) return { ok: true, added: 0, skipped };

  const { error } = await supabase.from("categories").insert(toAdd);
  if (error) return { error: error.message };
  revalidate();
  return { ok: true, added: toAdd.length, skipped };
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
