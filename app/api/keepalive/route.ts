import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep-alive endpoint. A scheduled GitHub Action hits this every few days so the
// free-tier Supabase project registers activity and never auto-pauses (which is
// what caused the intermittent "couldn't reach the server" on sign-in after a
// long idle gap). It runs one trivial DB request — RLS may return no rows, but
// the query still reaches Postgres, which is all that's needed to stay awake.
export async function GET() {
  const ts = new Date().toISOString();
  try {
    const supabase = await createClient();
    // HEAD request with an exact count — cheap, but a real hit on the database.
    const { error } = await supabase.from("units").select("id", { head: true, count: "exact" }).limit(1);
    return NextResponse.json({ ok: !error, ts, db: error ? "error" : "reached" });
  } catch {
    return NextResponse.json({ ok: false, ts, db: "unreachable" }, { status: 200 });
  }
}
