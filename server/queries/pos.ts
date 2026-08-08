import { createClient } from "@/lib/supabase/server";
import { POS_PROVIDERS, type PosProviderKey } from "@/lib/pos/providers";

export type ConnectorView = {
  key: PosProviderKey;
  name: string;
  status: "connected" | "disconnected" | "error";
  lastSyncAt: string | null;
  imported: number;
  failed: number;
};

export type SyncRun = {
  id: string;
  provider: string;
  source: string;
  file: string | null;
  total: number;
  ok: number;
  error: number;
  status: string;
  created_at: string;
};

export async function getPosOverview(orgId: string) {
  const supabase = await createClient();
  const [{ data: connectors }, { data: imports }] = await Promise.all([
    supabase.from("pos_connectors").select("provider, status, last_sync_at").eq("org_id", orgId),
    supabase.from("pos_imports")
      .select("id, provider, source, file_path, rows_total, rows_ok, rows_error, status, created_at")
      .eq("org_id", orgId).order("created_at", { ascending: false }).limit(30),
  ]);

  const connByKey = new Map((connectors ?? []).map((c: any) => [c.provider, c]));
  const totals = new Map<string, { ok: number; err: number }>();
  for (const r of imports ?? []) {
    const t = totals.get(r.provider) ?? { ok: 0, err: 0 };
    t.ok += Number(r.rows_ok) || 0;
    t.err += Number(r.rows_error) || 0;
    totals.set(r.provider, t);
  }

  const items: ConnectorView[] = POS_PROVIDERS.map((p) => {
    const c: any = connByKey.get(p.key);
    const t = totals.get(p.key) ?? { ok: 0, err: 0 };
    return {
      key: p.key,
      name: p.name,
      status: (c?.status as ConnectorView["status"]) ?? "disconnected",
      lastSyncAt: c?.last_sync_at ?? null,
      imported: t.ok,
      failed: t.err,
    };
  });

  const history: SyncRun[] = (imports ?? []).map((r: any) => ({
    id: r.id,
    provider: r.provider ?? "petpooja",
    source: r.source ?? "csv",
    file: r.file_path ?? null,
    total: Number(r.rows_total) || 0,
    ok: Number(r.rows_ok) || 0,
    error: Number(r.rows_error) || 0,
    status: r.status ?? "done",
    created_at: r.created_at,
  }));

  return { items, history };
}
