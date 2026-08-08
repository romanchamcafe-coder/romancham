"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { POS_PROVIDERS, providerName } from "@/lib/pos/providers";
import type { ActionState } from "@/lib/types";

function isAdmin(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

/** Mark a provider connected (enables it in the workspace). API sync itself is
 *  provider-specific and, for planned providers, still "coming soon". */
export async function connectProvider(provider: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!isAdmin(ctx.role)) return { error: "Only an owner or admin can manage connectors" };
  if (!POS_PROVIDERS.some((p) => p.key === provider)) return { error: "Unknown provider" };
  const supabase = await createClient();
  const { error } = await supabase.from("pos_connectors")
    .upsert({ org_id: ctx.orgId, provider, status: "connected", created_by: ctx.user.id }, { onConflict: "org_id,provider" });
  if (error) return { error: error.message };
  revalidatePath("/pos");
  return { ok: true };
}

export async function disconnectProvider(provider: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!isAdmin(ctx.role)) return { error: "Only an owner or admin can manage connectors" };
  const supabase = await createClient();
  const { error } = await supabase.from("pos_connectors")
    .update({ status: "disconnected" }).eq("org_id", ctx.orgId).eq("provider", provider);
  if (error) return { error: error.message };
  revalidatePath("/pos");
  return { ok: true };
}

/** Trigger a sync. CSV providers import via the Sales upload; API providers are
 *  not yet live, so this returns a clear "coming soon" for them. */
export async function syncNow(provider: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (provider === "petpooja") {
    return { error: "Use the CSV import on the Sales page for Petpooja (direct API sync is coming soon)." };
  }
  return { error: `Direct API sync for ${providerName(provider)} is coming soon. CSV import is available today.` };
}

/** Record a completed sync run against a connector (called by importers). */
export async function touchConnectorSync(provider: string): Promise<void> {
  try {
    const ctx = await getActiveContext();
    if (!ctx?.orgId) return;
    const supabase = await createClient();
    await supabase.from("pos_connectors").upsert(
      { org_id: ctx.orgId, provider, status: "connected", last_sync_at: new Date().toISOString(), created_by: ctx.user.id },
      { onConflict: "org_id,provider" },
    );
  } catch { /* best-effort */ }
}
