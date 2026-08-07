import { createClient } from "@/lib/supabase/server";
import { CHECKLISTS } from "@/lib/ops/checklists";

function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function weekStart() { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10); }
const today = () => new Date().toISOString().slice(0, 10);

export async function getOpsOverview(orgId: string, branchId: string | null) {
  try {
    const supabase = await createClient();
    const t = today();
    let runQ = supabase.from("ops_checklist_runs")
      .select("checklist_type, score, done, total, run_date")
      .eq("org_id", orgId).eq("run_date", t);
    if (branchId) runQ = runQ.eq("branch_id", branchId);

    let wasteQ = supabase.from("ops_wastage")
      .select("occurred_on, reason, cost").eq("org_id", orgId).gte("occurred_on", monthStart());
    if (branchId) wasteQ = wasteQ.eq("branch_id", branchId);

    const [{ data: runs }, { data: waste }] = await Promise.all([runQ, wasteQ]);

    const runMap = new Map((runs ?? []).map((r: any) => [r.checklist_type, r]));
    const checklists = CHECKLISTS.map((c) => {
      const r = runMap.get(c.type);
      return { type: c.type, title: c.title, short: c.short, doneToday: !!r, score: r ? Number(r.score) : 0, done: r?.done ?? 0, total: r?.total ?? c.items.length };
    });
    const completedToday = checklists.filter((c) => c.doneToday).length;
    const completionPct = checklists.length ? Math.round((completedToday / checklists.length) * 100) : 0;

    const ws = weekStart();
    let wToday = 0, wWeek = 0, wMonth = 0;
    const byReason: Record<string, number> = {};
    for (const w of waste ?? []) {
      const c = Number(w.cost) || 0;
      wMonth += c;
      if (w.occurred_on >= ws) wWeek += c;
      if (w.occurred_on === t) wToday += c;
      byReason[w.reason] = (byReason[w.reason] || 0) + c;
    }

    return {
      checklists, completedToday, completionPct,
      wastage: { today: wToday, week: wWeek, month: wMonth, byReason },
    };
  } catch (e) {
    console.error("getOpsOverview failed", e);
    return { checklists: [], completedToday: 0, completionPct: 0, wastage: { today: 0, week: 0, month: 0, byReason: {} } };
  }
}

export async function getChecklistRunToday(orgId: string, branchId: string | null, type: string) {
  try {
    const supabase = await createClient();
    let q = supabase.from("ops_checklist_runs").select("id, items, notes, score, performed_by, created_at")
      .eq("org_id", orgId).eq("checklist_type", type).eq("run_date", today());
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data ?? null;
  } catch { return null; }
}

export async function getWastage(orgId: string, branchId: string | null, limit = 100) {
  try {
    const supabase = await createClient();
    let q = supabase.from("ops_wastage")
      .select("id, occurred_on, item_name, qty, unit, reason, cost, note")
      .eq("org_id", orgId).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    return data ?? [];
  } catch { return []; }
}

export async function getWastageItems(orgId: string) {
  try {
    const supabase = await createClient();
    const [{ data: ings }, { data: layers }, { data: units }] = await Promise.all([
      supabase.from("ingredients").select("id, name, base_unit_id").eq("org_id", orgId).eq("is_active", true).order("name"),
      supabase.from("inventory_cost_layers").select("ingredient_id, unit_cost, received_at").eq("org_id", orgId).order("received_at", { ascending: false }),
      supabase.from("units").select("id, abbr").eq("org_id", orgId),
    ]);
    const cost = new Map<string, number>();
    for (const l of layers ?? []) if (!cost.has(l.ingredient_id)) cost.set(l.ingredient_id, Number(l.unit_cost) || 0);
    const uni = new Map((units ?? []).map((u: any) => [u.id, u.abbr]));
    return (ings ?? []).map((i: any) => ({ id: i.id, name: i.name, unit: i.base_unit_id ? uni.get(i.base_unit_id) ?? "" : "", cost: cost.get(i.id) ?? 0 }));
  } catch { return []; }
}
