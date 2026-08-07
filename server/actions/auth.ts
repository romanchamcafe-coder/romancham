"use server";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

const FRIENDLY_NETWORK =
  "We couldn't reach the server just now. Please check your internet and try again in a moment.";

// A transient/network error (e.g. Supabase briefly unreachable) — the old
// raw "fetch failed" message. We retry these and, if still failing, show a
// friendly message instead of a scary technical one.
function isTransient(msg?: string | null) {
  const m = (msg || "").toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("econn") ||
    m.includes("und_err") ||
    m.includes("upstream") ||
    m.includes("gateway")
  );
}

function friendly(msg?: string | null) {
  return isTransient(msg) ? FRIENDLY_NETWORK : msg || "Something went wrong. Please try again.";
}

// Retry a Supabase auth call a few times on transient network failures.
async function withRetry<T extends { error: { message?: string } | null }>(
  fn: () => Promise<T>,
  tries = 3,
): Promise<T> {
  let last: T = { error: { message: "fetch failed" } } as T;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fn();
      if (!res.error || !isTransient(res.error.message)) return res;
      last = res;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "fetch failed";
      last = { error: { message } } as T;
      if (!isTransient(message)) return last;
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return last;
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

export async function signIn(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createClient();
  const { error } = await withRetry(() => supabase.auth.signInWithPassword({ email, password }));
  if (error) return { error: friendly(error.message) };
  redirect("/dashboard");
}

export async function signUp(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const fullName = String(formData.get("full_name"));
  const orgName = String(formData.get("org_name"));
  const supabase = await createClient();

  const { data, error } = await withRetry(() =>
    supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } }),
  );
  if (error) return { error: friendly(error.message) };
  if (!data.session) {
    return { message: "Check your email to confirm your account, then log in." };
  }

  const slug =
    orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
    "-" + Math.random().toString(36).slice(2, 6);
  const { error: rpcErr } = await supabase.rpc("bootstrap_org", {
    p_name: orgName,
    p_slug: slug,
    p_branch: "Main Branch",
  });
  if (rpcErr) return { error: friendly(rpcErr.message) };
  redirect("/dashboard");
}

// Step 1 of recovery: email the user a reset link.
export async function requestPasswordReset(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Enter the email you signed up with" };
  const supabase = await createClient();
  const origin = await siteOrigin();
  const redirectTo = `${origin}/auth/callback?next=/reset-password`;
  const { error } = await withRetry(() => supabase.auth.resetPasswordForEmail(email, { redirectTo }));
  if (error) return { error: friendly(error.message) };
  return {
    message: `If an account exists for ${email}, a password-reset link is on its way. Check your inbox (and spam folder), then follow the link to set a new password.`,
  };
}

// Step 2 of recovery: after the user clicks the email link (which signs them
// into a temporary recovery session), set the new password.
export async function updatePassword(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 6) return { error: "Password must be at least 6 characters" };
  if (password !== confirm) return { error: "The two passwords don't match" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "This reset link has expired or was already used. Request a new one from 'Forgot password'." };
  const { error } = await withRetry(() => supabase.auth.updateUser({ password }));
  if (error) return { error: friendly(error.message) };
  redirect("/dashboard");
}

// Create the organization for a signed-in user who doesn't have one yet
// (e.g. they confirmed their email, which doesn't create the org). This is
// what the /welcome onboarding page submits to, and it prevents the
// "logged in but no org" redirect loop.
export async function createOrg(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const orgName = String(formData.get("org_name") || "").trim();
  if (!orgName) return { error: "Enter your business name" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired — please sign in again." };

  // already has an org? just go in.
  const { data: existing } = await supabase.from("memberships").select("id").eq("user_id", user.id).eq("is_active", true).limit(1);
  if (existing && existing.length > 0) redirect("/dashboard");

  const slug =
    orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
    "-" + Math.random().toString(36).slice(2, 6);
  const { error } = await withRetry(() =>
    supabase.rpc("bootstrap_org", { p_name: orgName, p_slug: slug, p_branch: "Main Branch" }).then((r) => ({ error: r.error })),
  );
  if (error) return { error: friendly(error.message) };
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
