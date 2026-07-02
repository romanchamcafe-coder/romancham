import { createClient } from "@/lib/supabase/server";

export async function getSettings(orgId: string) {
  const supabase = await createClient();
  const [{ data: org }, { data: branches }, { data: members }] = await Promise.all([
    supabase.from("organizations").select("name, slug, gstin, state_code, plan, address, phone, email").eq("id", orgId).single(),
    supabase.from("branches").select("id, name, state_code, is_active").eq("org_id", orgId).order("name"),
    supabase.from("memberships").select("role, user_id, profiles(full_name)").eq("org_id", orgId),
  ]);
  return { org, branches: branches ?? [], members: members ?? [] };
}
