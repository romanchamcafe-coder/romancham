"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

const ROLES = ["owner", "manager", "accountant", "staff"] as const;

async function activeOwners(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string) {
  const { data } = await supabase.from("memberships")
    .select("user_id").eq("org_id", orgId).eq("role", "owner").eq("is_active", true);
  return data ?? [];
}

export async function updateMemberRole(userId: string, role: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (ctx.role !== "owner") return { error: "Only the owner can manage the team" };
  if (!ROLES.includes(role as any)) return { error: "Invalid role" };
  const supabase = await createClient();
  if (role !== "owner") {
    const owners = await activeOwners(supabase, ctx.orgId);
    if (owners.length <= 1 && owners.some((o) => o.user_id === userId))
      return { error: "You can't change the last owner's role. Make someone else an owner first." };
  }
  const { error } = await supabase.from("memberships").update({ role }).eq("org_id", ctx.orgId).eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (ctx.role !== "owner") return { error: "Only the owner can manage the team" };
  if (userId === ctx.user.id) return { error: "You can't remove yourself." };
  const supabase = await createClient();
  const { data: target } = await supabase.from("memberships")
    .select("role").eq("org_id", ctx.orgId).eq("user_id", userId).maybeSingle();
  if (target?.role === "owner") {
    const owners = await activeOwners(supabase, ctx.orgId);
    if (owners.length <= 1) return { error: "You can't remove the last owner." };
  }
  const { error } = await supabase.from("memberships").update({ is_active: false }).eq("org_id", ctx.orgId).eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return { ok: true };
}
