import { createClient } from "@/lib/supabase/server";

export type BackupRow = {
  id: string;
  kind: string;
  size_bytes: number;
  created_at: string;
  created_by_name: string;
  records: number;
};

export function prettyBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export async function getBackups(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("backups")
    .select("id, kind, size_bytes, table_counts, created_at, profiles(full_name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(60);

  const rows: BackupRow[] = (data ?? []).map((b: any) => ({
    id: b.id,
    kind: b.kind,
    size_bytes: b.size_bytes ?? 0,
    created_at: b.created_at,
    created_by_name: b.profiles?.full_name ?? "Automatic",
    records: b.table_counts ? Object.values(b.table_counts).reduce((s: number, v) => s + (Number(v) || 0), 0) : 0,
  }));

  return {
    rows,
    lastBackup: rows[0]?.created_at ?? null,
    dataSize: rows[0]?.size_bytes ?? 0,
    count: rows.length,
  };
}
