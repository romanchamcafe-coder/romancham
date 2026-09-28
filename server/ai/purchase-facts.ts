import { createClient } from "@/lib/supabase/server";

// ============================================================
// Purchases snapshot for Romancham AI.
// Pre-computes everything the AI needs to answer purchase / procurement
// questions (spend, vendors, categories, items, rates, payables, trend)
// so the LLM never has to do the maths itself.
// Window: last 90 days (so "last month" questions also work).
// ============================================================

const num = (v: any) => Number(v) || 0;
const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Agg = { spend: number; bills: Set<string>; lines: number };

export async function getPurchaseAiFacts(orgId: string, branchId: string | null) {
  const supabase = await createClient();
  const to = new Date();
  const from = new Date(to.getTime() - 89 * 86400000);
  const monthStart = iso(new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1)));

  let q = supabase.from("purchase_items")
    .select("qty, rate, unit_price, pack_qty, pack_size, purchase_uom, uom, category, gst_rate, line_total, ingredient_id, ingredients(name), purchases!inner(id, org_id, branch_id, bill_date, bill_no, total, payment_status, payment_mode, vendors(name))")
    .eq("purchases.org_id", orgId)
    .gte("purchases.bill_date", iso(from)).lte("purchases.bill_date", iso(to))
    .limit(20000);
  if (branchId) q = q.eq("purchases.branch_id", branchId);
  const { data, error } = await q;
  if (error) return { available: false, error: error.message };
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return { available: true, window: `${iso(from)} to ${iso(to)}`, note: "No purchases recorded in the last 90 days." };

  // Line value (without GST): prefer packages × price per package, else base qty × base rate.
  const lineValue = (r: any) => (r.pack_qty != null && r.unit_price != null)
    ? num(r.pack_qty) * num(r.unit_price) : num(r.qty) * num(r.rate);

  const bills = new Map<string, { date: string; vendor: string; total: number; status: string; mode: string; billNo: string | null }>();
  const byVendor = new Map<string, Agg>();
  const byCategory = new Map<string, Agg>();
  const byMonth = new Map<string, Agg>();
  const byItem = new Map<string, { name: string; uom: string; qty: number; spend: number; buys: number; minRate: number; maxRate: number; lastRate: number; lastDate: string; vendors: Set<string> }>();
  const byDay = new Map<string, number>();

  const add = (m: Map<string, Agg>, k: string, v: number, bill: string) => {
    const a = m.get(k) ?? { spend: 0, bills: new Set<string>(), lines: 0 };
    a.spend += v; a.bills.add(bill); a.lines += 1; m.set(k, a);
  };

  for (const r of rows) {
    const p = r.purchases; if (!p) continue;
    const v = lineValue(r);
    const vendor = p.vendors?.name ?? "Unknown vendor";
    const cat = r.category || "Uncategorised";
    const month = String(p.bill_date).slice(0, 7);
    bills.set(p.id, { date: p.bill_date, vendor, total: num(p.total), status: p.payment_status ?? "unpaid", mode: p.payment_mode ?? "", billNo: p.bill_no ?? null });
    add(byVendor, vendor, v, p.id);
    add(byCategory, cat, v, p.id);
    add(byMonth, month, v, p.id);
    byDay.set(p.bill_date, (byDay.get(p.bill_date) ?? 0) + v);

    const name = r.ingredients?.name ?? "—";
    const rate = num(r.rate); // price per base unit
    const it = byItem.get(r.ingredient_id) ?? { name, uom: r.uom ?? "", qty: 0, spend: 0, buys: 0, minRate: Infinity, maxRate: 0, lastRate: 0, lastDate: "", vendors: new Set<string>() };
    it.qty += num(r.qty); it.spend += v; it.buys += 1; it.vendors.add(vendor);
    if (rate > 0) { it.minRate = Math.min(it.minRate, rate); it.maxRate = Math.max(it.maxRate, rate); }
    if (p.bill_date >= it.lastDate) { it.lastDate = p.bill_date; it.lastRate = rate; }
    byItem.set(r.ingredient_id, it);
  }

  const totalSpend = [...byVendor.values()].reduce((s, a) => s + a.spend, 0);
  const pct = (v: number) => (totalSpend > 0 ? r2((v / totalSpend) * 100) : 0);
  const list = (m: Map<string, Agg>, key: string) => [...m.entries()]
    .map(([k, a]) => ({ [key]: k, spend: r2(a.spend), sharePct: pct(a.spend), bills: a.bills.size, lines: a.lines }))
    .sort((a: any, b: any) => b.spend - a.spend);

  const billList = [...bills.values()];
  const thisMonth = billList.filter((b) => b.date >= monthStart);
  const unpaid = billList.filter((b) => b.status !== "paid");
  const pettyCash = billList.filter((b) => b.mode === "petty_cash");

  const items = [...byItem.values()].map((i) => ({
    item: i.name, baseUnit: i.uom, totalQtyBase: r2(i.qty), spend: r2(i.spend), sharePct: pct(i.spend), timesBought: i.buys,
    minRatePerBase: i.minRate === Infinity ? 0 : r2(i.minRate), maxRatePerBase: r2(i.maxRate), lastRatePerBase: r2(i.lastRate), lastBought: i.lastDate,
    rateSpreadPct: i.minRate > 0 && i.minRate !== Infinity ? r2(((i.maxRate - i.minRate) / i.minRate) * 100) : 0,
    vendors: [...i.vendors],
  })).sort((a, b) => b.spend - a.spend);

  return {
    available: true,
    window: `${iso(from)} to ${iso(to)} (last 90 days)`,
    note: "Spend figures are WITHOUT GST (packages × price per package). Bill totals include GST.",
    totals: {
      spendWithoutGst: r2(totalSpend),
      billsTotalWithGst: r2(billList.reduce((s, b) => s + b.total, 0)),
      bills: billList.length, lineItems: rows.length, distinctItems: byItem.size, distinctVendors: byVendor.size,
      thisMonth: { from: monthStart, bills: thisMonth.length, totalWithGst: r2(thisMonth.reduce((s, b) => s + b.total, 0)) },
      unpaid: { bills: unpaid.length, amountWithGst: r2(unpaid.reduce((s, b) => s + b.total, 0)) },
      pettyCash: { bills: pettyCash.length, amountWithGst: r2(pettyCash.reduce((s, b) => s + b.total, 0)) },
      avgBillValueWithGst: billList.length ? r2(billList.reduce((s, b) => s + b.total, 0) / billList.length) : 0,
    },
    byMonth: list(byMonth, "month").sort((a: any, b: any) => String(a.month).localeCompare(String(b.month))),
    byVendor: list(byVendor, "vendor").slice(0, 25),
    byCategory: list(byCategory, "category").slice(0, 25),
    topItemsBySpend: items.slice(0, 30),
    itemsWithBiggestPriceSwings: items.filter((i) => i.rateSpreadPct >= 10 && i.timesBought > 1)
      .sort((a, b) => b.rateSpreadPct - a.rateSpreadPct).slice(0, 10),
    dailySpend: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, spend: r2(v) })).slice(-45),
    recentBills: billList.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15)
      .map((b) => ({ date: b.date, vendor: b.vendor, billNo: b.billNo, totalWithGst: r2(b.total), status: b.status, mode: b.mode })),
  };
}
