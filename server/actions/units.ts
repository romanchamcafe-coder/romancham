"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

async function isDuplicate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string, name: string, abbr: string, excludeId: string | null,
) {
  const { data } = await supabase
    .from("units").select("id, name, abbr").eq("org_id", orgId).eq("is_active", true);
  const n = name.trim().toLowerCase();
  const a = abbr.trim().toLowerCase();
  return (data ?? []).some(
    (r: any) => r.id !== excludeId &&
      (String(r.name).trim().toLowerCase() === n || String(r.abbr).trim().toLowerCase() === a),
  );
}

export async function createUnit(name: string, abbr: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const n = (name || "").trim();
  const a = (abbr || "").trim();
  if (!n || !a) return { error: "Name and abbreviation are required" };
  const supabase = await createClient();
  if (await isDuplicate(supabase, ctx.orgId, n, a, null)) return { error: `"${n}" or "${a}" already exists` };
  const { error } = await supabase.from("units").insert({ org_id: ctx.orgId, name: n, abbr: a, factor_to_base: 1 });
  if (error) return { error: error.message };
  revalidatePath("/masters/units");
  return { ok: true };
}

export async function updateUnit(id: string, name: string, abbr: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const n = (name || "").trim();
  const a = (abbr || "").trim();
  if (!n || !a) return { error: "Name and abbreviation are required" };
  const supabase = await createClient();
  if (await isDuplicate(supabase, ctx.orgId, n, a, id)) return { error: `"${n}" or "${a}" already exists` };
  const { error } = await supabase.from("units").update({ name: n, abbr: a }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/masters/units");
  return { ok: true };
}

export async function archiveUnit(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const supabase = await createClient();
  const { error } = await supabase.from("units").update({ is_active: false }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/masters/units");
  return { ok: true };
}
