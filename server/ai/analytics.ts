import { createClient } from "@/lib/supabase/server";
import { getDashboard, type DashboardMetrics } from "@/server/queries/dashboard";

// ============================================================
// Romancham AI — deterministic insight engine.
// All numbers are computed here from real data (the LLM never does the math);
// insights, health score, briefing and recommendations are rule-based so they
// can never hallucinate. Everything is org- + branch-scoped and runs server-side.
// ============================================================

export type Severity = "critical" | "high" | "medium" | "positive";
export type Insight = { id: string; severity: Severity; title: string; detail: string; impact?: string; action?: string };
export type HealthComponent = { label: string; points: number };
export type Recommendation = { problem: string; evidence: string; cause?: string; impact?: string; action: string; priority: "HIGH" | "MEDIUM" | "LOW" };

export type Metrics = {
  revenue: number; orders: number; avgBill: number; purchases: number; expenses: number;
  cogs: number; foodCostPct: number; grossProfit: number; grossMarginPct: number;
  netProfit: number; netMarginPct: number; expenseRatioPct: number;
  inventoryValue: number; wastageValue: number; wastagePct: number; payables: number;
};

export type Intelligence = {
  range: { from: string; to: string; label: string };
  prevRange: { from: string; to: string };
  metrics: Metrics;
  deltas: { revenue: number; avgBill: number; orders: number; grossProfit: number; expenses: number; wastage: number; foodCostPp: number };
  topSellers: DashboardMetrics["top_sellers"];
  leastSellers: DashboardMetrics["least_sellers"];
  lowStock: DashboardMetrics["low_stock"];
  insights: Insight[];
  recommendations: Recommendation[];
  health: { score: number; band: string; components: HealthComponent[] };
  briefing: { day: string; salesToday: number; ordersToday: number; avgBillToday: number; foodCostToday: number; lines: string[]; actions: string[] };
  dataUsed: string[];
  generatedAt: string;
};

const TARGET_FOOD_COST = 30; // % — configurable target
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const num = (v: any) => Number(v) || 0;
const pctChange = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function prevWindow(from: string, to: string) {
  const f = new Date(from + "T00:00:00Z"), t = new Date(to + "T00:00:00Z");
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const pTo = new Date(f.getTime() - 86400000);
  const pFrom = new Date(pTo.getTime() - (days - 1) * 86400000);
  return { from: iso(pFrom), to: iso(pTo) };
}

async function ordersAndAvg(supabase: any, orgId: string, branchId: string | null, from: string, to: string) {
  let q = supabase.from("pos_sales").select("invoice_no, final_total").eq("org_id", orgId)
    .gte("sale_date", from).lte("sale_date", to).limit(20000);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  const rows = data ?? [];
  const invoices = new Set<string>();
  let nullInvoices = 0;
  for (const r of rows) {
    const inv = (r.invoice_no ?? "").trim();
    if (inv) invoices.add(inv); else nullInvoices++;
  }
  const orders = invoices.size + nullInvoices;
  const revenue = rows.reduce((s: number, r: any) => s + num(r.final_total), 0);
  return { orders, revenue, avgBill: orders > 0 ? revenue / orders : 0 };
}

async function wastage(supabase: any, orgId: string, branchId: string | null, from: string, to: string) {
  let q = supabase.from("ops_wastage").select("item_name, reason, cost, occurred_on").eq("org_id", orgId)
    .gte("occurred_on", from).lte("occurred_on", to).limit(5000);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  const rows = data ?? [];
  const total = rows.reduce((s: number, r: any) => s + num(r.cost), 0);
  const byReason = new Map<string, number>();
  const byItem = new Map<string, number>();
  for (const r of rows) {
    byReason.set(r.reason || "other", (byReason.get(r.reason || "other") || 0) + num(r.cost));
    byItem.set(r.item_name || "—", (byItem.get(r.item_name || "—") || 0) + num(r.cost));
  }
  const topReason = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0];
  const topItem = [...byItem.entries()].sort((a, b) => b[1] - a[1])[0];
  return { total, topReason, topItem };
}

async function inventoryValueAndAgeing(supabase: any, orgId: string, branchId: string | null) {
  let q = supabase.from("inventory_cost_layers").select("ingredient_id, qty_remaining, unit_cost, received_at, ingredients(name)")
    .eq("org_id", orgId).gt("qty_remaining", 0).limit(10000);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  const rows = data ?? [];
  let value = 0;
  const ageing: { name: string; value: number; days: number }[] = [];
  const now = Date.now();
  const byIng = new Map<string, { name: string; value: number; oldest: number }>();
  for (const r of rows) {
    const v = num(r.qty_remaining) * num(r.unit_cost);
    value += v;
    const days = r.received_at ? Math.floor((now - new Date(r.received_at).getTime()) / 86400000) : 0;
    const key = r.ingredient_id;
    const cur = byIng.get(key) || { name: r.ingredients?.name ?? "—", value: 0, oldest: 0 };
    cur.value += v; cur.oldest = Math.max(cur.oldest, days);
    byIng.set(key, cur);
  }
  for (const [, v] of byIng) if (v.oldest >= 45 && v.value > 0) ageing.push({ name: v.name, value: v.value, days: v.oldest });
  ageing.sort((a, b) => b.value - a.value);
  return { value, ageing };
}

async function payables(supabase: any, orgId: string, branchId: string | null) {
  let q = supabase.from("purchases").select("total, payment_status").eq("org_id", orgId).limit(20000);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  return (data ?? []).filter((r: any) => r.payment_status && r.payment_status !== "paid").reduce((s: number, r: any) => s + num(r.total), 0);
}

// Average purchase rate per ingredient (per base unit) in a window — for price-rise detection.
async function ingredientRates(supabase: any, orgId: string, branchId: string | null, from: string, to: string) {
  let q = supabase.from("purchase_items")
    .select("ingredient_id, rate, qty, ingredients(name), purchases!inner(org_id, branch_id, bill_date)")
    .eq("purchases.org_id", orgId).gte("purchases.bill_date", from).lte("purchases.bill_date", to).limit(10000);
  if (branchId) q = q.eq("purchases.branch_id", branchId);
  const { data } = await q;
  const rows = data ?? [];
  const acc = new Map<string, { name: string; totQty: number; totVal: number }>();
  for (const r of rows) {
    const key = r.ingredient_id;
    const cur = acc.get(key) || { name: r.ingredients?.name ?? "—", totQty: 0, totVal: 0 };
    cur.totQty += num(r.qty); cur.totVal += num(r.qty) * num(r.rate);
    acc.set(key, cur);
  }
  const out = new Map<string, { name: string; rate: number }>();
  for (const [k, v] of acc) if (v.totQty > 0) out.set(k, { name: v.name, rate: v.totVal / v.totQty });
  return out;
}

async function checklistCompliance(supabase: any, orgId: string, branchId: string | null, from: string, to: string) {
  let q = supabase.from("ops_checklist_runs").select("score, done, total, run_date").eq("org_id", orgId)
    .gte("run_date", from).lte("run_date", to).limit(2000);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  const rows = data ?? [];
  if (rows.length === 0) return { avgScore: null as number | null, runs: 0, incomplete: 0 };
  const avgScore = rows.reduce((s: number, r: any) => s + num(r.score), 0) / rows.length;
  const incomplete = rows.filter((r: any) => num(r.done) < num(r.total)).length;
  return { avgScore, runs: rows.length, incomplete };
}

export async function getIntelligence(
  orgId: string, branchId: string | null, from: string, to: string, label = "This period",
): Promise<Intelligence> {
  const supabase = await createClient();
  const pr = prevWindow(from, to);
  const today = iso(new Date());

  const [cur, prev, curOrders, prevOrders, waCur, waPrev, invNow, pay, ratesCur, ratesPrev, checks, todayD] = await Promise.all([
    getDashboard(orgId, branchId, from, to),
    getDashboard(orgId, branchId, pr.from, pr.to),
    ordersAndAvg(supabase, orgId, branchId, from, to),
    ordersAndAvg(supabase, orgId, branchId, pr.from, pr.to),
    wastage(supabase, orgId, branchId, from, to),
    wastage(supabase, orgId, branchId, pr.from, pr.to),
    inventoryValueAndAgeing(supabase, orgId, branchId),
    payables(supabase, orgId, branchId),
    ingredientRates(supabase, orgId, branchId, from, to),
    ingredientRates(supabase, orgId, branchId, pr.from, pr.to),
    checklistCompliance(supabase, orgId, branchId, from, to),
    getDashboard(orgId, branchId, today, today).catch(() => null),
  ]);

  const revenue = num(cur.revenue);
  const grossProfit = num(cur.gross_profit);
  const netProfit = num(cur.net_profit);
  const expenses = num(cur.expenses);
  const cogs = num(cur.cogs);
  const foodCostPct = num(cur.food_cost_pct);
  const wastageValue = waCur.total;

  const metrics: Metrics = {
    revenue, orders: curOrders.orders, avgBill: curOrders.avgBill, purchases: num(cur.purchases), expenses,
    cogs, foodCostPct, grossProfit, grossMarginPct: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    netProfit, netMarginPct: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    expenseRatioPct: revenue > 0 ? (expenses / revenue) * 100 : 0,
    inventoryValue: invNow.value, wastageValue, wastagePct: revenue > 0 ? (wastageValue / revenue) * 100 : 0, payables: pay,
  };

  const deltas = {
    revenue: pctChange(revenue, num(prev.revenue)),
    avgBill: pctChange(curOrders.avgBill, prevOrders.avgBill),
    orders: pctChange(curOrders.orders, prevOrders.orders),
    grossProfit: pctChange(grossProfit, num(prev.gross_profit)),
    expenses: pctChange(expenses, num(prev.expenses)),
    wastage: pctChange(wastageValue, waPrev.total),
    foodCostPp: foodCostPct - num(prev.food_cost_pct),
  };

  // ---- price-rise detection ----
  const priceRises: { name: string; from: number; to: number; pct: number }[] = [];
  for (const [k, v] of ratesCur) {
    const p = ratesPrev.get(k);
    if (p && p.rate > 0 && v.rate > p.rate * 1.05) priceRises.push({ name: v.name, from: p.rate, to: v.rate, pct: pctChange(v.rate, p.rate) });
  }
  priceRises.sort((a, b) => b.pct - a.pct);

  // ---- build insights ----
  const insights: Insight[] = [];
  const recs: Recommendation[] = [];

  // Food cost
  if (foodCostPct > 0) {
    if (foodCostPct > TARGET_FOOD_COST + 2) {
      const pp = r1(foodCostPct - TARGET_FOOD_COST);
      const impact = revenue > 0 ? (foodCostPct - TARGET_FOOD_COST) / 100 * revenue : 0;
      insights.push({
        id: "food_cost_high", severity: foodCostPct > TARGET_FOOD_COST + 6 ? "critical" : "high",
        title: `Food cost is ${r1(foodCostPct)}% (target ${TARGET_FOOD_COST}%)`,
        detail: `Food cost is ${pp} pp above target${deltas.foodCostPp > 0.5 ? `, up ${r1(deltas.foodCostPp)} pp vs the previous period` : ""}.`,
        impact: impact > 0 ? `≈ ${inr(impact)} of gross profit at stake this period` : undefined,
        action: "Review your top ingredient purchase prices and portion/recipe sizes.",
      });
      recs.push({
        problem: `Food cost is ${r1(foodCostPct)}% vs a ${TARGET_FOOD_COST}% target`,
        evidence: `Food cost ${r1(num(prev.food_cost_pct))}% → ${r1(foodCostPct)}%.`,
        cause: priceRises.length ? `Purchase prices rose on ${priceRises.length} ingredient(s).` : "Ingredient prices, portioning or wastage.",
        impact: impact > 0 ? `≈ ${inr(impact)}/period lower gross profit` : undefined,
        action: "Renegotiate the top price-risen ingredients and re-check recipe portions.",
        priority: "HIGH",
      });
    } else if (deltas.foodCostPp >= 2) {
      insights.push({ id: "food_cost_up", severity: "high", title: `Food cost rose ${r1(deltas.foodCostPp)} pp`, detail: `From ${r1(num(prev.food_cost_pct))}% to ${r1(foodCostPct)}%.`, action: "Check ingredient prices and wastage." });
    }
  }

  // Revenue trend
  if (num(prev.revenue) > 0) {
    if (deltas.revenue <= -5) {
      insights.push({ id: "sales_down", severity: deltas.revenue <= -12 ? "critical" : "high", title: `Sales down ${r1(Math.abs(deltas.revenue))}%`, detail: `${inr(revenue)} vs ${inr(num(prev.revenue))} in the previous period.`, action: "Check declining products/categories and footfall days." });
      recs.push({ problem: `Revenue fell ${r1(Math.abs(deltas.revenue))}%`, evidence: `${inr(num(prev.revenue))} → ${inr(revenue)}.`, action: "Identify which products/days drove the drop and run a targeted promo.", priority: "HIGH" });
    } else if (deltas.revenue >= 5) {
      insights.push({ id: "sales_up", severity: "positive", title: `Sales up ${r1(deltas.revenue)}%`, detail: `${inr(revenue)} vs ${inr(num(prev.revenue))}.`, action: "Keep momentum — reinforce what's working." });
    }
  }

  // Average bill
  if (prevOrders.avgBill > 0 && Math.abs(deltas.avgBill) >= 5) {
    insights.push({
      id: "avg_bill", severity: deltas.avgBill >= 0 ? "positive" : "medium",
      title: `Average bill ${deltas.avgBill >= 0 ? "up" : "down"} ${r1(Math.abs(deltas.avgBill))}%`,
      detail: `${inr(metrics.avgBill)} vs ${inr(prevOrders.avgBill)} (${metrics.orders} orders).`,
      action: deltas.avgBill >= 0 ? "Sustain upselling/combos." : "Add combos and upsell prompts at billing.",
    });
  }

  // Gross profit
  if (num(prev.gross_profit) > 0 && deltas.grossProfit <= -5) {
    insights.push({ id: "gp_down", severity: "high", title: `Gross profit down ${r1(Math.abs(deltas.grossProfit))}%`, detail: `${inr(grossProfit)} vs ${inr(num(prev.gross_profit))}.`, action: "Address food cost and low-margin items." });
  }

  // Wastage
  if (wastageValue > 0) {
    const high = metrics.wastagePct > 2 || (waPrev.total > 0 && deltas.wastage >= 15);
    if (high) {
      insights.push({
        id: "wastage_high", severity: metrics.wastagePct > 4 ? "critical" : "high",
        title: `Wastage ${inr(wastageValue)} (${r1(metrics.wastagePct)}% of sales)`,
        detail: `${waPrev.total > 0 ? `Up ${r1(deltas.wastage)}% vs previous. ` : ""}${waCur.topReason ? `Top reason: ${waCur.topReason[0]} (${inr(waCur.topReason[1])}). ` : ""}${waCur.topItem ? `Most wasted: ${waCur.topItem[0]}.` : ""}`,
        impact: `≈ ${inr(wastageValue)} lost this period`,
        action: "Investigate the top wastage reason/item and tighten prep-to-order.",
      });
      recs.push({ problem: `Wastage is ${r1(metrics.wastagePct)}% of sales`, evidence: `${inr(wastageValue)} logged${waCur.topItem ? `, led by ${waCur.topItem[0]}` : ""}.`, impact: `≈ ${inr(wastageValue)}/period`, action: `Reduce ${waCur.topReason ? waCur.topReason[0] : "top-reason"} wastage; batch-produce to demand.`, priority: metrics.wastagePct > 4 ? "HIGH" : "MEDIUM" });
    }
  }

  // Purchase price rises
  if (priceRises.length) {
    const top = priceRises.slice(0, 3).map((p) => `${p.name} +${r1(p.pct)}%`).join(", ");
    insights.push({ id: "price_rise", severity: "high", title: `${priceRises.length} ingredient price increase${priceRises.length > 1 ? "s" : ""}`, detail: `${top}${priceRises.length > 3 ? "…" : ""}.`, action: "Renegotiate or find alternate suppliers for these items." });
    recs.push({ problem: `${priceRises.length} ingredient prices rose`, evidence: top, action: "Renegotiate vendor pricing or switch suppliers for the top items.", priority: "MEDIUM" });
  }

  // Inventory ageing / dead stock
  if (invNow.ageing.length) {
    const val = invNow.ageing.reduce((s, a) => s + a.value, 0);
    insights.push({ id: "inv_ageing", severity: val > revenue * 0.1 ? "high" : "medium", title: `${invNow.ageing.length} slow-moving item(s), ${inr(val)} tied up`, detail: `Oldest stock ${invNow.ageing[0].days} days${invNow.ageing[0] ? ` (${invNow.ageing[0].name})` : ""}.`, action: "Use or run down these items; pause reordering them." });
    recs.push({ problem: `${inr(val)} tied up in slow-moving stock`, evidence: `${invNow.ageing.length} ingredients aged 45+ days.`, impact: `${inr(val)} working capital`, action: "Feature these in specials and stop purchasing until cleared.", priority: "MEDIUM" });
  }

  // Stock-out risk
  if ((cur.low_stock ?? []).length) {
    insights.push({ id: "stock_out", severity: "medium", title: `${cur.low_stock.length} item(s) low / out of stock`, detail: cur.low_stock.slice(0, 4).map((s) => s.name).join(", ") + (cur.low_stock.length > 4 ? "…" : ""), action: "Reorder before service to avoid missed sales." });
  }

  // Payables
  if (pay > 0 && pay > revenue * 0.25) {
    insights.push({ id: "payables", severity: "medium", title: `${inr(pay)} in unpaid vendor bills`, detail: "Outstanding payables are high relative to sales.", action: "Plan payments to protect vendor terms and cash flow." });
  }

  // Least sellers (poor performers)
  if ((cur.least_sellers ?? []).length) {
    insights.push({ id: "poor_products", severity: "medium", title: "Under-performing menu items", detail: `Lowest movers: ${cur.least_sellers.slice(0, 3).map((s) => s.name).join(", ")}.`, action: "Review pricing, placement, or consider removing from the menu." });
  }

  // Top sellers opportunity (positive)
  if ((cur.top_sellers ?? []).length) {
    insights.push({ id: "top_products", severity: "positive", title: "Your best sellers", detail: `${cur.top_sellers.slice(0, 3).map((s) => s.name).join(", ")} lead sales — protect their stock and quality.`, action: "Never stock out on these; build combos around them." });
  }

  // Checklist compliance
  if (checks.avgScore != null && checks.avgScore < 85) {
    insights.push({ id: "ops_compliance", severity: checks.avgScore < 60 ? "high" : "medium", title: `Checklist compliance ${r1(checks.avgScore)}%`, detail: `${checks.incomplete} of ${checks.runs} runs incomplete this period.`, action: "Reinforce opening/closing and food-safety checklists." });
  }

  // sort: critical > high > medium > positive
  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, positive: 3 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  // ---- health score ----
  const components: HealthComponent[] = [];
  let score = 70; // neutral baseline
  const add = (label: string, pts: number) => { if (pts !== 0) { components.push({ label, points: pts }); score += pts; } };

  if (foodCostPct > 0) add(`Food cost ${r1(foodCostPct)}%`, foodCostPct <= TARGET_FOOD_COST ? 8 : foodCostPct <= TARGET_FOOD_COST + 3 ? 2 : foodCostPct <= TARGET_FOOD_COST + 6 ? -6 : -12);
  if (metrics.grossMarginPct !== 0) add(`Gross margin ${r1(metrics.grossMarginPct)}%`, metrics.grossMarginPct >= 65 ? 8 : metrics.grossMarginPct >= 55 ? 3 : metrics.grossMarginPct >= 45 ? -2 : -8);
  if (revenue > 0) add(`Wastage ${r1(metrics.wastagePct)}%`, metrics.wastagePct <= 1 ? 5 : metrics.wastagePct <= 2 ? 1 : metrics.wastagePct <= 4 ? -5 : -10);
  if (num(prev.revenue) > 0) add(`Sales ${deltas.revenue >= 0 ? "+" : ""}${r1(deltas.revenue)}%`, deltas.revenue >= 5 ? 6 : deltas.revenue >= -2 ? 2 : deltas.revenue >= -8 ? -4 : -8);
  if (metrics.netProfit !== 0 || revenue > 0) add(`Net margin ${r1(metrics.netMarginPct)}%`, metrics.netMarginPct >= 12 ? 6 : metrics.netMarginPct >= 5 ? 2 : metrics.netMarginPct >= 0 ? -2 : -8);
  if (invNow.ageing.length) add("Slow-moving stock", invNow.ageing.reduce((s, a) => s + a.value, 0) > revenue * 0.1 ? -6 : -3);
  if (checks.avgScore != null) add(`Checklists ${r1(checks.avgScore)}%`, checks.avgScore >= 90 ? 3 : checks.avgScore >= 75 ? 0 : -4);
  if (pay > revenue * 0.4 && revenue > 0) add("High payables", -3);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band = score >= 80 ? "Healthy" : score >= 60 ? "Needs attention" : "Critical";

  // ---- briefing ----
  const bLines: string[] = [];
  const critical = insights.find((i) => i.severity === "critical" || i.severity === "high");
  const opp = insights.find((i) => i.severity === "positive") || insights.find((i) => i.id === "inv_ageing");
  if (critical) bLines.push(`⚠️ ${critical.title}`);
  if (opp) bLines.push(`💡 ${opp.title}`);
  const bActions = recs.slice(0, 4).map((r) => r.action);
  const briefing = {
    day: today,
    salesToday: todayD ? num(todayD.revenue) : 0,
    ordersToday: 0,
    avgBillToday: 0,
    foodCostToday: todayD ? num(todayD.food_cost_pct) : 0,
    lines: bLines,
    actions: bActions.length ? bActions : ["Record today's sales and purchases to unlock insights."],
  };

  return {
    range: { from, to, label }, prevRange: pr, metrics, deltas,
    topSellers: cur.top_sellers ?? [], leastSellers: cur.least_sellers ?? [], lowStock: cur.low_stock ?? [],
    insights: insights.slice(0, 10), recommendations: recs.slice(0, 6),
    health: { score, band, components },
    briefing,
    dataUsed: [
      `Sales & food cost: ${from} → ${to}`,
      `Comparison: ${pr.from} → ${pr.to}`,
      `Inventory & payables: as of ${today}`,
      `Wastage & checklists: ${from} → ${to}`,
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function monthRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const from = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const to = iso(now);
  return { from, to, label: "This month" };
}
