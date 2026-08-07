import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Cap the auth check so a slow/unreachable Supabase can't hang the
// middleware until Vercel kills it (MIDDLEWARE_INVOCATION_TIMEOUT / 504).
const AUTH_TIMEOUT_MS = 5000;
const TIMEOUT = Symbol("timeout");

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup");
  const isProtected = path.startsWith("/dashboard") || path.startsWith("/masters") ||
    path.startsWith("/purchases") || path.startsWith("/sales") || path.startsWith("/inventory") ||
    path.startsWith("/expenses") || path.startsWith("/branches") || path.startsWith("/settings");

  // Race the auth lookup against a timeout. If Supabase is slow or errors,
  // fail open: let the request through instead of returning a 504. The page's
  // own server checks (and RLS) still protect data.
  let user: { id: string } | null = null;
  try {
    const timer = new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), AUTH_TIMEOUT_MS));
    const result = await Promise.race([supabase.auth.getUser(), timer]);
    if (result === TIMEOUT) {
      return response; // auth check timed out — don't block the request
    }
    user = result.data?.user ?? null;
  } catch {
    return response; // auth check failed — fail open rather than 504
  }

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}
