"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { buildBackupPayload, saveBackup, applyRestore } from "@/lib/backup-core";
import type { ActionState } from "@/lib/types";

function isAdmin(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

export async function createBackup(): Promise<ActionState & { size?: number }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.org) return { error: "No active organization" };
  if (!isAdmin(ctx.role)) return { error: "Only an owner or admin can create backups" };
  const supabase = await createClient();
  const payload = await buildBackupPayload(supabase, ctx.org);
  const res = await saveBackup(supabase, ctx.orgId, "manual", payload, ctx.user.id);
  if (res.error) return { error: res.error };
  revalidatePath("/settings/team");
  return { ok: true, size: res.size };
}

export async function downloadBackup(id: string): Promise<{ error?: string; name?: string; json?: string }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!isAdmin(ctx.role)) return { error: "Only an owner or admin can download backups" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("backups").select("payload, created_at, kind").eq("id", id).eq("org_id", ctx.orgId).single();
  if (error || !data) return { error: "Backup not found" };
  const date = String(data.created_at).slice(0, 10);
  return { name: `romancham-${data.kind}-${date}.json`, json: JSON.stringify(data.payload, null, 2) };
}

export async function restoreFromBackup(id: string): Promise<ActionState & { restored?: number }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  // Restore is owner-only (matches the existing file-restore rule).
  if (ctx.role !== "owner") return { error: "Only the owner can restore data" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("backups").select("payload").eq("id", id).eq("org_id", ctx.orgId).single();
  if (error || !data) return { error: "Backup not found" };
  const { restored } = await applyRestore(supabase, data.payload as { tables?: Record<string, unknown[]> });
  revalidatePath("/settings/team");
  return { ok: true, restored };
}
