"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

export async function signIn(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signUp(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const fullName = String(formData.get("full_name"));
  const orgName = String(formData.get("org_name"));
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };
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
  if (rpcErr) return { error: rpcErr.message };
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
