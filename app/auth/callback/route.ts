import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Handles the link from Supabase auth emails (password recovery, email
// confirmation). Exchanges the one-time code for a session cookie, then
// forwards the user on (e.g. to /reset-password to choose a new password).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=link_expired`);
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
