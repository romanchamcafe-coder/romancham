"use server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { ROLES } from "@/lib/auth/permissions";
import { SITE_URL } from "@/lib/seo";
import { logActivity } from "@/server/audit";
import type { ActionState } from "@/lib/types";

const ASSIGNABLE = ROLES as readonly string[]; // 8 SaaS roles
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAdmin(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

async function siteOrigin() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  } catch {}
  return SITE_URL;
}

async function activeOwners(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string) {
  const { data } = await supabase.from("memberships")
    .select("user_id").eq("org_id", orgId).eq("role", "owner").eq("is_active", true);
  return data ?? [];
}

// ---------- Members ----------

export async function updateMemberRole(userId: string, role: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!isAdmin(ctx.role)) return { error: "Only an owner or admin can manage the team" };
  if (!ASSIGNABLE.includes(role)) return { error: "Invalid role" };
  const supabase = await createClient();
  if (role !== "owner") {
    const owners = await activeOwners(supabase, ctx.orgId);
    if (owners.length <= 1 && owners.some((o) => o.user_id === userId))
      return { error: "You can't change the last owner's role. Make someone else an owner first." };
  }
  const { error } = await supabase.from("memberships").update({ role }).eq("org_id", ctx.orgId).eq("user_id", userId);
  if (error) return { error: error.message };
  await logActivity({ action: "role_change", entity: "memberships", entityId: userId, newValue: { role } });
  revalidatePath("/settings/team");
  return { ok: true };
}

export async function setMemberStatus(userId: string, status: "active" | "suspended"): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!isAdmin(ctx.role)) return { error: "Only an owner or admin can manage the team" };
  if (userId === ctx.user.id) return { error: "You can't change your own status." };
  const supabase = await createClient();
  if (status === "suspended") {
    const { data: target } = await supabase.from("memberships")
      .select("role").eq("org_id", ctx.orgId).eq("user_id", userId).maybeSingle();
    if (target?.role === "owner") {
      const owners = await activeOwners(supabase, ctx.orgId);
      if (owners.length <= 1) return { error: "You can't suspend the last owner." };
    }
  }
  const { error } = await supabase.from("memberships")
    .update({ status, is_active: status === "active" })
    .eq("org_id", ctx.orgId).eq("user_id", userId);
  if (error) return { error: error.message };
  await logActivity({ action: status === "suspended" ? "suspend" : "reactivate", entity: "memberships", entityId: userId, newValue: { status } });
  revalidatePath("/settings/team");
  return { ok: true };
}

export async function setMemberBranches(userId: string, branchIds: string[]): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!isAdmin(ctx.role)) return { error: "Only an owner or admin can manage the team" };
  const supabase = await createClient();
  const { data: m } = await supabase.from("memberships")
    .select("id").eq("org_id", ctx.orgId).eq("user_id", userId).maybeSingle();
  if (!m) return { error: "Member not found" };
  await supabase.from("membership_branches").delete().eq("membership_id", m.id);
  if (branchIds.length) {
    const rows = branchIds.map((branch_id) => ({ membership_id: m.id, branch_id }));
    const { error } = await supabase.from("membership_branches").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath("/settings/team");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!isAdmin(ctx.role)) return { error: "Only an owner or admin can manage the team" };
  if (userId === ctx.user.id) return { error: "You can't remove yourself." };
  const supabase = await createClient();
  const { data: target } = await supabase.from("memberships")
    .select("role").eq("org_id", ctx.orgId).eq("user_id", userId).maybeSingle();
  if (target?.role === "owner") {
    const owners = await activeOwners(supabase, ctx.orgId);
    if (owners.length <= 1) return { error: "You can't remove the last owner." };
  }
  const { error } = await supabase.from("memberships")
    .update({ is_active: false, status: "removed" }).eq("org_id", ctx.orgId).eq("user_id", userId);
  if (error) return { error: error.message };
  await logActivity({ action: "remove_member", entity: "memberships", entityId: userId });
  revalidatePath("/settings/team");
  return { ok: true };
}

// ---------- Invitations ----------

export type InviteResult = ActionState & { link?: string };

export async function inviteTeammate(input: {
  email: string; role: string; branchIds?: string[];
}): Promise<InviteResult> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!isAdmin(ctx.role)) return { error: "Only an owner or admin can invite teammates" };
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address" };
  const role = ASSIGNABLE.includes(input.role) ? input.role : "viewer";
  const branchIds = input.branchIds ?? [];
  const supabase = await createClient();

  // Already a member?
  const { data: members } = await supabase.from("memberships")
    .select("user_id, profiles(full_name)").eq("org_id", ctx.orgId).eq("is_active", true);
  if ((members ?? []).some((m: any) => (m.profiles?.full_name ?? "").toLowerCase() === email))
    return { error: "That email is already an active member." };

  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Re-use an existing pending invite for the same email (refresh it) else create.
  const { data: existing } = await supabase.from("invitations")
    .select("id, token").eq("org_id", ctx.orgId).eq("email", email).eq("status", "pending").maybeSingle();

  let token = existing?.token as string | undefined;
  if (existing) {
    const { error } = await supabase.from("invitations").update({
      role, branch_ids: branchIds, expires_at, resent_at: new Date().toISOString(), invited_by: ctx.user.id,
    }).eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("invitations").insert({
      org_id: ctx.orgId, email, role, branch_ids: branchIds, expires_at,
      status: "pending", invited_by: ctx.user.id,
    }).select("token").single();
    if (error) return { error: error.message };
    token = data.token;
  }
  await logActivity({ action: "invite", entity: "invitations", newValue: { email, role } });
  revalidatePath("/settings/team");
  return { ok: true, link: `${await siteOrigin()}/invite/${token}` };
}

export async function resendInvitation(id: string): Promise<InviteResult> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!isAdmin(ctx.role)) return { error: "Only an owner or admin can manage invitations" };
  const supabase = await createClient();
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("invitations")
    .update({ status: "pending", expires_at, resent_at: new Date().toISOString() })
    .eq("id", id).eq("org_id", ctx.orgId).select("token").single();
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return { ok: true, link: `${await siteOrigin()}/invite/${data.token}` };
}

export async function cancelInvitation(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!isAdmin(ctx.role)) return { error: "Only an owner or admin can manage invitations" };
  const supabase = await createClient();
  const { error } = await supabase.from("invitations")
    .update({ status: "cancelled" }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  await logActivity({ action: "cancel_invite", entity: "invitations", entityId: id });
  revalidatePath("/settings/team");
  return { ok: true };
}

export async function acceptInvitation(token: string): Promise<ActionState & { code?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: error.message };
  const code = String(data);
  if (code !== "ok") {
    const messages: Record<string, string> = {
      not_authenticated: "Please sign in with the invited email first.",
      invalid: "This invitation link is not valid.",
      not_pending: "This invitation has already been used or cancelled.",
      expired: "This invitation has expired. Ask for a new one.",
      email_mismatch: "This invitation was sent to a different email address.",
    };
    return { error: messages[code] ?? "Could not accept the invitation.", code };
  }
  revalidatePath("/", "layout");
  return { ok: true, code };
}
