import { createClient } from "@/lib/supabase/server";
import { getPnl } from "@/server/queries/finance";
import { getInventory } from "@/server/queries/inventory";

const iso = (dt: Date) => dt.toISOString().slice(0, 10);
const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;
const pctDelta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0);

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

export async function getAnalytics(orgId: string, branchId: string | null) {
  const supabase = await createClient();
  const now = new Date();
  const today = iso(now);
  const yest = iso(new Date(Date.now() - 864e5));
  const dow = (now.getUTCDay() + 6) % 7; // Mon = 0
  const y = now.getUTCFullYear(), mo = now.getUTCMonth(), da = now.getUTCDate();
  const weekStart = iso(new Date(Date.UTC(y, mo, da - dow)));
  const lastWeekStart = iso(new Date(Date.UTC(y, mo, da - dow - 7)));
  const lastWeekEnd = iso(new Date(Date.UTC(y, mo, da - dow - 1)));
  const monthStart = iso(new Date(Date.UTC(y, mo, 1)));
  const lastMonthStart = iso(new Date(Date.UTC(y, mo - 1, 1)));
  const lastMonthEnd = iso(new Date(Date.UTC(y, mo, 0)));
  const min60 = iso(new Date(Date.now() - 60 * 864e5));
  const trendStart = iso(new Date(Date.now() - 13 * 864e5));

  let saleQ = supabase.from("pos_sales").select("sale_date, final_total, invoice_no, category, branch_id")
    .eq("org_id", orgId).gte("sale_date", min60);
  let purQ = supabase.from("purchases").select("bill_date, total").eq("org_id", orgId).gte("bill_date", min60);
  let expQ = supabase.from("expenses").select("expense_date, amount").eq("org_id", orgId).gte("expense_date", min60);
  if (branchId) { saleQ = saleQ.eq("branch_id", branchId); purQ = purQ.eq("branch_id", branchId); expQ = expQ.eq("branch_id", branchId); }
  const brQ = supabase.from("branches").select("id, name").eq("org_id", orgId);

  const [{ data: sales }, { data: purch }, { data: exps }, { data: branches }, pnl, inv] = await Promise.all([
    saleQ, purQ, expQ, brQ,
    getPnl(orgId, branchId, monthStart, today),
    getInventory(orgId, branchId),
  ]);

  const S = sales ?? [];
  const sumSales = (pred: (d: string) => boolean) => S.filter((r) => pred(String(r.sale_date))).reduce((s, r) => s + n(r.final_total), 0);
  const between = (a: string, b: string) => (d: string) => d >= a && d <= b;

  const todaySales = sumSales((d) => d === today);
  const yestSales = sumSales((d) => d === yest);
  const weekSales = sumSales((d) => d >= weekStart);
  const lastWeekSales = sumSales(between(lastWeekStart, lastWeekEnd));
  const monthSales = sumSales((d) => d >= monthStart);
  const lastMonthSales = sumSales(between(lastMonthStart, lastMonthEnd));

  const todayRows = S.filter((r) => String(r.sale_date) === today);
  const invoices = new Set(todayRows.map((r) => r.invoice_no).filter(Boolean));
  const orders = invoices.size || todayRows.length;
  const avgBill = orders ? todaySales / orders : 0;

  const inventoryValue = (inv ?? []).reduce((s, i) => s + n(i.value), 0);
  const stockTurnover = inventoryValue > 0 ? r2(pnl.purchases / inventoryValue) : 0;
  const wastagePct = pnl.revenue > 0 ? r2((pnl.wastage / pnl.revenue) * 100) : 0;
  const cashFlow = r2(pnl.revenue - pnl.purchases - pnl.expenses);

  // 14-day multi-trend
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(iso(new Date(Date.now() - i * 864e5)));
  const byDay = (rows: any[], dk: string, vk: string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(String(r[dk]), (m.get(String(r[dk])) ?? 0) + n(r[vk]));
    return m;
  };
  const sMap = byDay(S, "sale_date", "final_total");
  const pMap = byDay(purch ?? [], "bill_date", "total");
  const eMap = byDay(exps ?? [], "expense_date", "amount");
  const trend = days.filter((d) => d >= trendStart).map((d) => ({
    d: d.slice(5), sales: r2(sMap.get(d) ?? 0), purchases: r2(pMap.get(d) ?? 0), expenses: r2(eMap.get(d) ?? 0),
  }));

  // category (department) comparison — this month
  const catMap = new Map<string, number>();
  for (const r of S) if (String(r.sale_date) >= monthStart) {
    const c = (r.category || "Uncategorised").trim();
    catMap.set(c, (catMap.get(c) ?? 0) + n(r.final_total));
  }
  const categories = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, revenue]) => ({ name, revenue: r2(revenue) }));

  // branch comparison — this month
  const brName = new Map((branches ?? []).map((b: any) => [b.id, b.name]));
  const brMap = new Map<string, number>();
  for (const r of S) if (String(r.sale_date) >= monthStart) brMap.set(r.branch_id, (brMap.get(r.branch_id) ?? 0) + n(r.final_total));
  const branchCompare = [...brMap.entries()].map(([id, revenue]) => ({ name: brName.get(id) ?? "—", revenue: r2(revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    today: { value: r2(todaySales), delta: pctDelta(todaySales, yestSales) },
    week: { value: r2(weekSales), delta: pctDelta(weekSales, lastWeekSales) },
    month: { value: r2(monthSales), delta: pctDelta(monthSales, lastMonthSales) },
    orders, avgBill: r2(avgBill),
    cogs: r2(pnl.purchases),
    foodCostPct: pnl.foodCostPct, primeCostPct: pnl.primeCostPct, labourPct: pnl.labourPct,
    grossProfit: r2(pnl.grossProfit), netProfit: r2(pnl.netProfit), ebitda: r2(pnl.netProfit),
    inventoryValue: r2(inventoryValue), stockTurnover, wastagePct, cashFlow,
    trend, categories, branchCompare,
  };
}
