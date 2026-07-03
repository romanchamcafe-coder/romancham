import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { BACKUP_TABLES } from "@/lib/backup-tables";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const supabase = await createClient();
  const tables: Record<string, any[]> = {};
  for (const t of BACKUP_TABLES) {
    const { data, error } = await supabase.from(t).select("*");
    if (!error && data) tables[t] = data;
  }

  const payload = {
    app: "romancham",
    version: 1,
    exported_at: new Date().toISOString(),
    org_id: ctx.orgId,
    org_name: ctx.org?.name ?? "",
    tables,
  };

  const fname = `romancham-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${fname}"`,
      "cache-control": "no-store",
    },
  });
}
