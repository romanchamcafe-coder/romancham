import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { RESTORE_ORDER } from "@/lib/backup-tables";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (ctx.role && ctx.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can restore data" }, { status: 403 });
  }

  let payload: any;
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No backup file uploaded" }, { status: 400 });
    payload = JSON.parse(await file.text());
  } catch {
    return NextResponse.json({ error: "Could not read this backup file — is it the romancham-backup .json?" }, { status: 400 });
  }

  const tables = payload?.tables ?? {};
  if (payload?.app !== "romancham" || typeof tables !== "object") {
    return NextResponse.json({ error: "This doesn't look like a Romancham backup file" }, { status: 400 });
  }

  const supabase = await createClient();
  const summary: Record<string, any> = {};
  let restored = 0;

  for (const t of RESTORE_ORDER) {
    const rows: any[] = tables[t];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    let ok = 0;
    let err = "";
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from(t).upsert(chunk, { onConflict: "id" });
      if (error) { err = error.message; break; }
      ok += chunk.length;
    }
    summary[t] = err ? { restored: ok, error: err } : ok;
    restored += ok;
  }

  return NextResponse.json({ ok: true, restored, summary });
}
