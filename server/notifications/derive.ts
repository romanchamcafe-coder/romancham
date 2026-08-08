import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHECKLISTS } from "@/lib/ops/checklists";

export type Priority = "critical" | "high" | "medium" | "low";
export type Alert = { key: string; type: string; priority: Priority; title: string; body: string; href: string };

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Compute the current set of alerts for an org/branch from live data, then
 * reconcile the notifications table: insert new alerts (unread), delete resolved
 * ones. Read state on surviving alerts is preserved. Best-effort; never throws.
 */
export async function deriveAndSync(
  supabase: SupabaseClient,
  orgId: string,
  branchId: string | null,
): Promise<void> {
  try {
    const today = todayStr();
    const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const ingQ = supabase.from("ingredients")
      .select("id, name, reorder_level").eq("org_id", orgId).eq("is_active", true)
      .in("material_type", ["purchase", "both"]);
    let stockQ = supabase.from("v_current_stock").select("ingredient_id, qty").eq("org_id", orgId);
    if (branchId) stockQ = stockQ.eq("branch_id", branchId);
    let prQ = supabase.from("ops_purchase_requests").select("id").eq("org_id", orgId).eq("status", "pending");
    let inQ = supabase.from("ops_indents").select("id").eq("org_id", orgId).eq("status", "pending");
    let clQ = supabase.from("ops_checklist_runs").select("checklist_type, score").eq("org_id", orgId).eq("run_date", today);
    let wasteQ = supabase.from("ops_wastage").select("cost").eq("org_id", orgId).gte("occurred_on", weekAgo);
    let cashQ = supabase.from("ops_cash_recon").select("variance").eq("org_id", orgId).eq("recon_date", today);
    let payQ = supabase.from("purchases").select("id").eq("org_id", orgId).in("payment_status", ["unpaid", "partial"]).gte("bill_date", monthStart);
    let taskQ = supabase.from("ops_tasks").select("id").eq("org_id", orgId).is("completed_at", null).lt("due_at", new Date().toISOString());
    if (branchId) {
      prQ = prQ.eq("branch_id", branchId); inQ = inQ.eq("branch_id", branchId);
      clQ = clQ.eq("branch_id", branchId); wasteQ = wasteQ.eq("branch_id", branchId);
      cashQ = cashQ.eq("branch_id", branchId); payQ = payQ.eq("branch_id", branchId); taskQ = taskQ.eq("branch_id", branchId);
    }

    const [ings, stock, prs, indents, cls, waste, cash, pays, overdueTasks] = await Promise.all([
      ingQ, stockQ, prQ, inQ, clQ, wasteQ, cashQ, payQ, taskQ,
    ]);

    const qty = new Map<string, number>();
    for (const s of stock.data ?? []) qty.set(s.ingredient_id, (qty.get(s.ingredient_id) ?? 0) + (Number(s.qty) || 0));

    const alerts: Alert[] = [];

    for (const i of ings.data ?? []) {
      const q = qty.get(i.id) ?? 0;
      const reorder = Number(i.reorder_level) || 0;
      if (q <= 0 && reorder > 0) {
        alerts.push({ key: `stock_out:${i.id}`, type: "negative_stock", priority: "critical",
          title: `Out of stock: ${i.name}`, body: `${i.name} has no stock left. Reorder now.`, href: "/inventory" });
      } else if (reorder > 0 && q <= reorder) {
        alerts.push({ key: `stock_low:${i.id}`, type: "low_stock", priority: "high",
          title: `Low stock: ${i.name}`, body: `${i.name} is at ${q} (reorder ${reorder}).`, href: "/operations/indents" });
      }
    }

    const prCount = (prs.data ?? []).length;
    if (prCount > 0) alerts.push({ key: "pending_pr", type: "pending_purchase", priority: "medium",
      title: `${prCount} purchase request${prCount > 1 ? "s" : ""} pending`, body: "Approve or order pending purchase requests.", href: "/operations/purchase-requests" });

    const inCount = (indents.data ?? []).length;
    if (inCount > 0) alerts.push({ key: "pending_indent", type: "pending_indent", priority: "medium",
      title: `${inCount} indent${inCount > 1 ? "s" : ""} pending`, body: "Store has stock requests awaiting approval.", href: "/operations/indents" });

    const doneTypes = new Set((cls.data ?? []).map((c: any) => c.checklist_type));
    const pendingChecklists = CHECKLISTS.filter((c) => !doneTypes.has(c.type)).length;
    if (pendingChecklists > 0) alerts.push({ key: `checklist_pending:${today}`, type: "checklist_pending", priority: "medium",
      title: `${pendingChecklists} checklist${pendingChecklists > 1 ? "s" : ""} pending today`, body: "Daily operational checklists aren't complete yet.", href: "/operations" });

    const fs = (cls.data ?? []).find((c: any) => c.checklist_type === "food_safety");
    if (fs && Number(fs.score) < 100) alerts.push({ key: `food_safety_fail:${today}`, type: "food_safety_failed", priority: "critical",
      title: "Food safety checklist failed", body: `Today's food safety score is ${fs.score}%. Address failed items.`, href: "/operations/checklist/food_safety" });

    const wasteTotal = (waste.data ?? []).reduce((s: number, w: any) => s + (Number(w.cost) || 0), 0);
    if (wasteTotal >= 1000) alerts.push({ key: "high_wastage", type: "high_wastage", priority: "high",
      title: `High wastage this week`, body: `₹${Math.round(wasteTotal).toLocaleString("en-IN")} of wastage logged in the last 7 days.`, href: "/operations/wastage" });

    const variance = Number((cash.data ?? [])[0]?.variance ?? 0);
    if (cash.data && cash.data.length > 0 && Math.abs(variance) >= 1) alerts.push({ key: `cash_diff:${today}`, type: "cash_difference", priority: "high",
      title: `Cash ${variance > 0 ? "surplus" : "short"} today`, body: `Drawer is off by ₹${Math.abs(variance).toLocaleString("en-IN")}.`, href: "/operations/cash" });

    const payCount = (pays.data ?? []).length;
    if (payCount > 0) alerts.push({ key: "vendor_due", type: "vendor_payment_due", priority: "medium",
      title: `${payCount} vendor bill${payCount > 1 ? "s" : ""} unpaid`, body: "You have unpaid or part-paid purchase bills this month.", href: "/purchases" });

    const overdueCount = (overdueTasks.data ?? []).length;
    if (overdueCount > 0) alerts.push({ key: "tasks_overdue", type: "task_overdue", priority: "high",
      title: `${overdueCount} task${overdueCount > 1 ? "s" : ""} overdue`, body: "Assigned tasks are past their due time.", href: "/operations/tasks" });

    // Reconcile against stored notifications.
    const { data: existing } = await supabase.from("notifications").select("id, key").eq("org_id", orgId);
    const existingKeys = new Set((existing ?? []).map((r: any) => r.key).filter(Boolean));
    const currentKeys = new Set(alerts.map((a) => a.key));

    const toInsert = alerts.filter((a) => !existingKeys.has(a.key)).map((a) => ({
      org_id: orgId, branch_id: branchId, key: a.key, type: a.type, priority: a.priority,
      title: a.title, body: a.body, href: a.href, payload: {},
    }));
    if (toInsert.length) await supabase.from("notifications").insert(toInsert);

    const toDelete = (existing ?? []).filter((r: any) => r.key && !currentKeys.has(r.key)).map((r: any) => r.id);
    if (toDelete.length) await supabase.from("notifications").delete().in("id", toDelete);
  } catch (e) {
    console.error("deriveAndSync failed", e);
  }
}
