import { createClient } from "@/lib/supabase/server";

export async function getSettings(orgId: string) {
  const supabase = await createClient();
  const [{ data: org }, { data: branches }, { data: members }] = await Promise.all([
    supabase.from("organizations").select("name, slug, gstin, state_code, plan, address, phone, email").eq("id", orgId).single(),
    supabase.from("branches").select("id, name, state_code, is_active").eq("org_id", orgId).order("name"),
    supabase.from("memberships").select("role, user_id, is_active, profiles(full_name)").eq("org_id", orgId).eq("is_active", true),
  ]);
  return { org, branches: branches ?? [], members: members ?? [] };
}

export type TeamMember = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  name: string;
  last_login_at: string | null;
  created_at: string | null;
  branchIds: string[];
};

export type TeamInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string | null;
  created_at: string | null;
  resent_at: string | null;
  branch_ids: string[];
};

export async function getTeam(orgId: string) {
  const supabase = await createClient();
  const [{ data: branches }, { data: members }, { data: invites }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
    supabase
      .from("memberships")
      .select("id, user_id, role, status, last_login_at, created_at, profiles(full_name), membership_branches(branch_id)")
      .eq("org_id", orgId)
      .in("status", ["active", "suspended"])
      .order("created_at"),
    supabase
      .from("invitations")
      .select("id, email, role, status, expires_at, created_at, resent_at, branch_ids")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  const teamMembers: TeamMember[] = (members ?? []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    status: m.status ?? "active",
    name: m.profiles?.full_name ?? "",
    last_login_at: m.last_login_at ?? null,
    created_at: m.created_at ?? null,
    branchIds: (m.membership_branches ?? []).map((b: any) => b.branch_id),
  }));

  const invitations: TeamInvite[] = (invites ?? []).map((i: any) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    status: i.status ?? "pending",
    expires_at: i.expires_at ?? null,
    created_at: i.created_at ?? null,
    resent_at: i.resent_at ?? null,
    branch_ids: i.branch_ids ?? [],
  }));

  return { branches: branches ?? [], members: teamMembers, invitations };
}
