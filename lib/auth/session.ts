import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

type Role = "owner" | "manager" | "staff" | "accountant";

export type ActiveContext = {
  user: { id: string; email?: string };
  memberships: { id: string; org_id: string; role: Role }[];
  org: { id: string; name: string; slug: string } | null;
  orgId: string | null;
  role: Role | null;
  branches: { id: string; name: string }[];
  branch: { id: string; name: string } | null;
};

export async function getActiveContext(): Promise<ActiveContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const base: ActiveContext = {
    user: { id: user.id, email: user.email ?? undefined },
    memberships: [], org: null, orgId: null, role: null, branches: [], branch: null,
  };

  const { data: memberships } = await supabase
    .from("memberships")
    .select("id, org_id, role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!memberships || memberships.length === 0) return base;

  const cookieStore = await cookies();
  const wantedOrg = cookieStore.get("bm_org")?.value;
  const active = memberships.find((m) => m.org_id === wantedOrg) ?? memberships[0];

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("org_id", active.org_id)
    .eq("is_active", true)
    .order("name");

  const wantedBranch = cookieStore.get("bm_branch")?.value;
  const branch = branches?.find((b) => b.id === wantedBranch) ?? branches?.[0] ?? null;

  return {
    ...base,
    memberships: memberships.map((m) => ({ id: m.id, org_id: m.org_id, role: m.role as Role })),
    org: (active.organizations as unknown as { id: string; name: string; slug: string }) ?? null,
    orgId: active.org_id,
    role: active.role as Role,
    branches: branches ?? [],
    branch,
  };
}
