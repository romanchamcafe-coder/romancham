import { createClient } from "@/lib/supabase/server";
import { getPnl } from "@/server/queries/finance";
import { getInventory } from "@/server/queries/inventory";
import { WASTAGE_REASON_LABEL } from "@/lib/ops/checklists";
import type { Report } from "@/lib/report-defs";
export { REPORT_DEFS } from "@/lib/report-defs";
export type { Report, ReportKey } from "@/lib/report-defs";

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function getReport(
  key: string, orgId: string, branchId: string | null, from: string, to: string,
): Promise<Report> {
  const supabase = await createClient();
  const scope = <T extends { eq: (c: string, v: string) => T }>(q: T) => (branchId ? q.eq("branch_id", branchId) : q);

  switch (key) {
    case "sales_daily": {
      let q = supabase.from("pos_sales").select("sale_date, qty, final_total")
        .eq("org_id", orgId).gte("sale_date", from).lte("sale_date", to);
      const { data } = await scope(q as any);
      const byDay = new Map<string, { qty: number; rev: number }>();
      for (const s of data ?? []) {
        const d = String(s.sale_date);
        const cur = byDay.get(d) ?? { qty: 0, rev: 0 };
        cur.qty += n(s.qty); cur.rev += n(s.final_total);
        byDay.set(d, cur);
      }
      const rows = [...byDay.entries()].sort((a, b) => a[0] < b[0] ? 1 : -1)
        .map(([d, v]) => [d, r2(v.qty), r2(v.rev)]);
      const totRev = rows.reduce((s, r) => s + n(r[2]), 0);
      const totQty = rows.reduce((s, r) => s + n(r[1]), 0);
      return { headers: ["Date", "Qty", "Revenue"], rows, currencyCols: [2], totals: ["Total", r2(totQty), r2(totRev)] };
    }

    case "sales_by_item": {
      let q = supabase.from("pos_sales").select("item_name, qty, final_total")
        .eq("org_id", orgId).gte("sale_date", from).lte("sale_date", to);
      const { data } = await scope(q as any);
      const byItem = new Map<string, { qty: number; rev: number }>();
      for (const s of data ?? []) {
        const it = (s.item_name || "—").trim();
        const cur = byItem.get(it) ?? { qty: 0, rev: 0 };
        cur.qty += n(s.qty); cur.rev += n(s.final_total);
        byItem.set(it, cur);
      }
      const rows = [...byItem.entries()].sort((a, b) => b[1].rev - a[1].rev)
        .map(([it, v]) => [it, r2(v.qty), r2(v.rev)]);
      const totRev = rows.reduce((s, r) => s + n(r[2]), 0);
      return { headers: ["Item", "Qty sold", "Revenue"], rows, currencyCols: [2], totals: ["Total", "", r2(totRev)], note: "Sorted by revenue (top sellers first)." };
    }

    case "purchases_by_vendor": {
      let q = supabase.from("purchases").select("vendor_id, total, payment_status")
        .eq("org_id", orgId).gte("bill_date", from).lte("bill_date", to);
      const [{ data: purch }, { data: vendors }] = await Promise.all([
        scope(q as any), supabase.from("vendors").select("id, name").eq("org_id", orgId),
      ]);
      const vname = new Map((vendors ?? []).map((v: any) => [v.id, v.name]));
      const byV = new Map<string, { bills: number; total: number; unpaid: number }>();
      for (const p of purch ?? []) {
        const k = p.vendor_id ?? "—";
        const cur = byV.get(k) ?? { bills: 0, total: 0, unpaid: 0 };
        cur.bills += 1; cur.total += n(p.total);
        if (p.payment_status !== "paid") cur.unpaid += n(p.total);
        byV.set(k, cur);
      }
      const rows = [...byV.entries()].sort((a, b) => b[1].total - a[1].total)
        .map(([k, v]) => [k === "—" ? "—" : (vname.get(k) ?? "—"), v.bills, r2(v.total), r2(v.unpaid)]);
      const tot = rows.reduce((s, r) => s + n(r[2]), 0);
      const totU = rows.reduce((s, r) => s + n(r[3]), 0);
      return { headers: ["Vendor", "Bills", "Total", "Unpaid"], rows, currencyCols: [2, 3], totals: ["Total", "", r2(tot), r2(totU)] };
    }

    case "expenses_by_category": {
      let q = supabase.from("expenses").select("category_id, amount")
        .eq("org_id", orgId).gte("expense_date", from).lte("expense_date", to);
      const [{ data: exps }, { data: cats }] = await Promise.all([
        scope(q as any), supabase.from("categories").select("id, name").eq("org_id", orgId),
      ]);
      const cname = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
      const byC = new Map<string, { count: number; amt: number }>();
      for (const e of exps ?? []) {
        const k = e.category_id ?? "—";
        const cur = byC.get(k) ?? { count: 0, amt: 0 };
        cur.count += 1; cur.amt += n(e.amount);
        byC.set(k, cur);
      }
      const rows = [...byC.entries()].sort((a, b) => b[1].amt - a[1].amt)
        .map(([k, v]) => [k === "—" ? "Uncategorised" : (cname.get(k) ?? "—"), v.count, r2(v.amt)]);
      const tot = rows.reduce((s, r) => s + n(r[2]), 0);
      return { headers: ["Category", "Entries", "Amount"], rows, currencyCols: [2], totals: ["Total", "", r2(tot)] };
    }

    case "pnl": {
      const p = await getPnl(orgId, branchId, from, to);
      const ebitda = r2(p.netProfit + 0); // no D&A/interest tracked → EBITDA ≈ operating profit
      const rows: (string | number)[][] = [
        ["Revenue", r2(p.revenue)],
        ["Food cost (purchases)", r2(p.purchases)],
        ["Gross profit", r2(p.grossProfit)],
        ["Operating expenses", r2(p.expenses)],
        ["— of which labour", r2(p.labour)],
        ["Wastage", r2(p.wastage)],
        ["Net profit", r2(p.netProfit)],
        ["EBITDA (approx.)", ebitda],
        ["Food cost %", p.foodCostPct],
        ["Prime cost %", p.primeCostPct],
        ["Labour %", p.labourPct],
        ["Net margin %", p.netMarginPct],
      ];
      return { headers: ["Metric", "Value"], rows, currencyCols: [1], note: "EBITDA is approximated as operating profit (no depreciation/interest tracked). % rows are percentages, not ₹." };
    }

    case "inventory_valuation": {
      const inv = await getInventory(orgId, branchId);
      const rows = inv.map((i) => [i.name, i.uom || "—", r2(i.qty), r2(i.reorder), i.status, r2(i.value)]);
      const tot = inv.reduce((s, i) => s + n(i.value), 0);
      return { headers: ["Item", "UOM", "Qty", "Reorder", "Status", "Value"], rows, currencyCols: [5], totals: ["Total", "", "", "", "", r2(tot)] };
    }

    case "wastage_by_reason": {
      let q = supabase.from("ops_wastage").select("reason, cost")
        .eq("org_id", orgId).gte("occurred_on", from).lte("occurred_on", to);
      const { data } = await scope(q as any);
      const byR = new Map<string, { count: number; cost: number }>();
      for (const w of data ?? []) {
        const k = w.reason ?? "other";
        const cur = byR.get(k) ?? { count: 0, cost: 0 };
        cur.count += 1; cur.cost += n(w.cost);
        byR.set(k, cur);
      }
      const rows = [...byR.entries()].sort((a, b) => b[1].cost - a[1].cost)
        .map(([k, v]) => [WASTAGE_REASON_LABEL[k] ?? k, v.count, r2(v.cost)]);
      const tot = rows.reduce((s, r) => s + n(r[2]), 0);
      return { headers: ["Reason", "Entries", "Cost"], rows, currencyCols: [2], totals: ["Total", "", r2(tot)] };
    }

    case "compliance": {
      let q = supabase.from("ops_checklist_runs").select("checklist_type, score, run_date")
        .eq("org_id", orgId).gte("run_date", from).lte("run_date", to);
      const { data } = await scope(q as any);
      const byT = new Map<string, { runs: number; score: number }>();
      for (const c of data ?? []) {
        const k = c.checklist_type ?? "—";
        const cur = byT.get(k) ?? { runs: 0, score: 0 };
        cur.runs += 1; cur.score += n(c.score);
        byT.set(k, cur);
      }
      const rows = [...byT.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
        .map(([k, v]) => [k.replace(/_/g, " "), v.runs, `${v.runs ? Math.round(v.score / v.runs) : 0}%`]);
      return { headers: ["Checklist", "Runs completed", "Avg score"], rows, note: "Runs completed in the selected date range, with the average compliance score." };
    }

    default:
      return { headers: ["Info"], rows: [["Select a report"]] };
  }
}
