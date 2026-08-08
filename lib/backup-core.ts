import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BACKUP_TABLES, RESTORE_ORDER } from "@/lib/backup-tables";

export type BackupPayload = {
  app: "romancham";
  version: number;
  exported_at: string;
  org_id: string;
  org_name: string;
  tables: Record<string, unknown[]>;
};

/** Build a full, RLS-scoped snapshot of the signed-in user's organization. */
export async function buildBackupPayload(
  supabase: SupabaseClient,
  org: { id: string; name?: string | null },
): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    const { data, error } = await supabase.from(t).select("*");
    if (!error && data) tables[t] = data;
  }
  return {
    app: "romancham",
    version: 1,
    exported_at: new Date().toISOString(),
    org_id: org.id,
    org_name: org.name ?? "",
    tables,
  };
}

const RETENTION: Record<string, number> = { daily: 14, weekly: 8, monthly: 12, manual: 20 };

/** Insert a snapshot row (with size + per-table counts) and prune old ones by kind. */
export async function saveBackup(
  supabase: SupabaseClient,
  orgId: string,
  kind: "daily" | "weekly" | "monthly" | "manual",
  payload: BackupPayload,
  createdBy: string | null,
): Promise<{ id?: string; size?: number; error?: string }> {
  const size = new TextEncoder().encode(JSON.stringify(payload)).length;
  const table_counts = Object.fromEntries(
    Object.entries(payload.tables).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
  );
  const { data, error } = await supabase
    .from("backups")
    .insert({ org_id: orgId, kind, payload, size_bytes: size, table_counts, created_by: createdBy })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { data: ids } = await supabase
    .from("backups").select("id").eq("org_id", orgId).eq("kind", kind)
    .order("created_at", { ascending: false });
  const extra = (ids ?? []).slice(RETENTION[kind] ?? 20).map((r: { id: string }) => r.id);
  if (extra.length) await supabase.from("backups").delete().in("id", extra);
  return { id: data.id, size };
}

/**
 * Create daily/weekly/monthly snapshots that don't yet exist for the current
 * period. Called on admin activity so backups happen automatically without cron.
 * Builds the payload at most once.
 */
export async function ensureScheduledBackups(
  supabase: SupabaseClient,
  org: { id: string; name?: string | null },
  userId: string | null,
): Promise<void> {
  try {
    const { data: recent } = await supabase
      .from("backups").select("kind, created_at")
      .eq("org_id", org.id).in("kind", ["daily", "weekly", "monthly"])
      .order("created_at", { ascending: false });
    const rows = recent ?? [];

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dow = (now.getUTCDay() + 6) % 7; // Monday=0
    const startOfWeek = new Date(startOfDay); startOfWeek.setUTCDate(startOfDay.getUTCDate() - dow);
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const has = (kind: string, since: Date) =>
      rows.some((r: { kind: string; created_at: string }) => r.kind === kind && new Date(r.created_at) >= since);

    const need: ("daily" | "weekly" | "monthly")[] = [];
    if (!has("daily", startOfDay)) need.push("daily");
    if (!has("weekly", startOfWeek)) need.push("weekly");
    if (!has("monthly", startOfMonth)) need.push("monthly");
    if (need.length === 0) return;

    const payload = await buildBackupPayload(supabase, org);
    for (const kind of need) await saveBackup(supabase, org.id, kind, payload, userId);
  } catch {
    // never block page render on auto-backup
  }
}

/** Upsert a backup payload back into the database (by id), parents first. */
export async function applyRestore(
  supabase: SupabaseClient,
  payload: { tables?: Record<string, unknown[]> },
): Promise<{ restored: number; summary: Record<string, unknown> }> {
  const tables = payload?.tables ?? {};
  const summary: Record<string, unknown> = {};
  let restored = 0;
  for (const t of RESTORE_ORDER) {
    const rows = tables[t];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    let ok = 0;
    let err = "";
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from(t).upsert(chunk as never[], { onConflict: "id" });
      if (error) { err = error.message; break; }
      ok += chunk.length;
    }
    summary[t] = err ? { restored: ok, error: err } : ok;
    restored += ok;
  }
  return { restored, summary };
}
