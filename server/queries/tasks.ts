import { createClient } from "@/lib/supabase/server";

export type TaskRow = {
  id: string;
  title: string;
  task_type: string;
  priority: string;
  assignee: string | null;
  due_at: string | null;
  completed_at: string | null;
  note: string | null;
};

const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export async function getTasks(orgId: string, branchId: string | null) {
  const supabase = await createClient();
  let q = supabase
    .from("ops_tasks")
    .select("id, title, task_type, priority, due_at, completed_at, note, profiles!ops_tasks_assigned_to_fkey(full_name)")
    .eq("org_id", orgId)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;

  const rows: TaskRow[] = (data ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    task_type: t.task_type,
    priority: t.priority,
    assignee: t.profiles?.full_name ?? null,
    due_at: t.due_at ?? null,
    completed_at: t.completed_at ?? null,
    note: t.note ?? null,
  }));

  rows.sort((a, b) => {
    const ac = a.completed_at ? 1 : 0, bc = b.completed_at ? 1 : 0;
    if (ac !== bc) return ac - bc;
    const pr = (RANK[a.priority] ?? 9) - (RANK[b.priority] ?? 9);
    if (pr !== 0) return pr;
    return (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999");
  });
  return rows;
}

export async function getTaskStats(orgId: string, branchId: string | null) {
  const supabase = await createClient();
  let q = supabase.from("ops_tasks").select("completed_at, due_at").eq("org_id", orgId);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  const all = data ?? [];
  const open = all.filter((t: any) => !t.completed_at);
  const now = new Date().toISOString();
  const overdue = open.filter((t: any) => t.due_at && t.due_at < now).length;
  const done = all.length - open.length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  return { total: all.length, open: open.length, done, overdue, pct };
}

export async function getAssignees(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("user_id, profiles!memberships_user_id_fkey(full_name)")
    .eq("org_id", orgId).eq("is_active", true);
  return (data ?? []).map((m: any) => ({ id: m.user_id, name: m.profiles?.full_name ?? "Member" }));
}
