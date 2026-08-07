import { createClient } from "@/lib/supabase/server";

const sum = (arr: any[], k: string) => (arr ?? []).reduce((s, r) => s + (Number(r[k]) || 0), 0);
const LABOUR = /salar|wage|labour|labor|payroll|staff/i;

export function monthRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export async function getPnl(orgId: string, branchId: string | null, from: string, to: string) {
  try {
    const supabase = await createClient();
    let saleQ = supabase.from("pos_sales").select("final_total, payment_type").eq("org_id", orgId).gte("sale_date", from).lte("sale_date", to);
    let purQ = supabase.from("purchases").select("total").eq("org_id", orgId).gte("bill_date", from).lte("bill_date", to);
    let expQ = supabase.from("expenses").select("amount, category_id").eq("org_id", orgId).gte("expense_date", from).lte("expense_date", to);
    let wasteQ = supabase.from("ops_wastage").select("cost").eq("org_id", orgId).gte("occurred_on", from).lte("occurred_on", to);
    if (branchId) { saleQ = saleQ.eq("branch_id", branchId); purQ = purQ.eq("branch_id", branchId); expQ = expQ.eq("branch_id", branchId); wasteQ = wasteQ.eq("branch_id", branchId); }
    const catQ = supabase.from("categories").select("id, name").eq("org_id", orgId);

    const [{ data: sales }, { data: purch }, { data: exps }, { data: waste }, { data: cats }] =
      await Promise.all([saleQ, purQ, expQ, wasteQ, catQ]);

    const revenue = sum(sales ?? [], "final_total");
    const cashRev = (sales ?? []).filter((s: any) => /cash/i.test(s.payment_type || "")).reduce((a: number, s: any) => a + (Number(s.final_total) || 0), 0);
    const purchases = sum(purch ?? [], "total");
    const wastage = sum(waste ?? [], "cost");
    const catName = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
    let expenses = 0, labour = 0;
    for (const e of exps ?? []) {
      const a = Number(e.amount) || 0; expenses += a;
      if (e.category_id && LABOUR.test(catName.get(e.category_id) || "")) labour += a;
    }
    const grossProfit = revenue - purchases;
    const netProfit = revenue - purchases - expenses;
    const pct = (n: number) => (revenue ? Math.round((n / revenue) * 1000) / 10 : 0);

    return {
      revenue, cashRev, purchases, expenses, labour, wastage,
      grossProfit, netProfit,
      foodCostPct: pct(purchases), primeCostPct: pct(purchases + labour),
      labourPct: pct(labour), expensePct: pct(expenses), netMarginPct: pct(netProfit),
    };
  } catch (e) {
    console.error("getPnl failed", e);
    return { revenue: 0, cashRev: 0, purchases: 0, expenses: 0, labour: 0, wastage: 0, grossProfit: 0, netProfit: 0, foodCostPct: 0, primeCostPct: 0, labourPct: 0, expensePct: 0, netMarginPct: 0 };
  }
}

export async function getCashRecon(orgId: string, branchId: string | null) {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);
    let rowQ = supabase.from("ops_cash_recon").select("*").eq("org_id", orgId).eq("recon_date", today);
    let salesQ = supabase.from("pos_sales").select("final_total, payment_type").eq("org_id", orgId).eq("sale_date", today);
    let recentQ = supabase.from("ops_cash_recon").select("id, recon_date, expected, counted, variance").eq("org_id", orgId).order("recon_date", { ascending: false }).limit(14);
    if (branchId) { rowQ = rowQ.eq("branch_id", branchId); salesQ = salesQ.eq("branch_id", branchId); recentQ = recentQ.eq("branch_id", branchId); }
    const [{ data: row }, { data: sales }, { data: recent }] = await Promise.all([rowQ.maybeSingle(), salesQ, recentQ]);
    const cashSalesToday = (sales ?? []).filter((s: any) => /cash/i.test(s.payment_type || "")).reduce((a: number, s: any) => a + (Number(s.final_total) || 0), 0);
    return { row: row ?? null, cashSalesToday: Math.round(cashSalesToday * 100) / 100, recent: recent ?? [] };
  } catch (e) {
    console.error("getCashRecon failed", e);
    return { row: null, cashSalesToday: 0, recent: [] };
  }
}
