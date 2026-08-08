import { createClient } from "@/lib/supabase/server";

export type ActivityRow = {
  id: string;
  created_at: string;
  action: string;
  entity: string;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  ip: string | null;
  user_agent: string | null;
  user_name: string;
  branch_name: string | null;
};

export async function getActivity(
  orgId: string,
  opts: { from?: string; to?: string; limit?: number } = {},
): Promise<ActivityRow[]> {
  try {
    const supabase = await createClient();
    let q = supabase
      .from("audit_logs")
      .select("id, created_at, action, entity, entity_id, old_value, new_value, ip, user_agent, profiles(full_name), branches(name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 500);
    if (opts.from) q = q.gte("created_at", `${opts.from}T00:00:00`);
    if (opts.to) q = q.lte("created_at", `${opts.to}T23:59:59`);
    const { data } = await q;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      action: r.action ?? "",
      entity: r.entity ?? "",
      entity_id: r.entity_id ?? null,
      old_value: r.old_value ?? null,
      new_value: r.new_value ?? null,
      ip: r.ip ?? null,
      user_agent: r.user_agent ?? null,
      user_name: r.profiles?.full_name ?? "System",
      branch_name: r.branches?.name ?? null,
    }));
  } catch (e) {
    console.error("getActivity failed", e);
    return [];
  }
}
