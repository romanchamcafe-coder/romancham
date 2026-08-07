import { getActiveContext } from "@/lib/auth/session";
import { getDashboard, getActivityCounts } from "@/server/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RevenueTrend, BranchPerf } from "@/components/charts/lazy-charts";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { resolveRange, type RangeKey } from "@/lib/date-ranges";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { inr } from "@/lib/utils";
import { TrendingUp, LineChart, BarChart3, Package, Info } from "lucide-react";

export const metadata: Metadata = pageMetadata({ title: "Dashboard", description: "Your café at a glance — sales, food cost, top items and today's operational status.", path: "/dashboard" });

const fmtDate = (iso: string) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0);

function Trend({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const up = value > 0;
  return <span className={"inline-flex items-center gap-0.5 text-xs font-medium " + (up ? "text-green-600" : "text-red-600")}>{up ? "▲" : "▼"} {Math.abs(value)}%</span>;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return null;
  const sp = await searchParams;
  const key = ((sp.range as RangeKey) || "30d");
  const r = resolveRange(key, sp.from, sp.to);

  const [m, prev, counts] = await Promise.all([
    getDashboard(ctx.orgId, ctx.branch?.id ?? null, r.from, r.to),
    getDashboard(ctx.orgId, ctx.branch?.id ?? null, r.prevFrom, r.prevTo),
    getActivityCounts(ctx.orgId, ctx.branch?.id ?? null),
  ]);

  const allZero = m.revenue === 0 && m.purchases === 0 && m.gross_profit === 0 && m.net_profit === 0;
  const zeroBanner = !allZero ? null
    : counts.sales > 0
      ? "No data in this period. Try changing the date range — you have sales recorded on other dates."
      : counts.purchases > 0
        ? "No data in this period. Try changing the date range — you have records on other dates."
        : "Get started by recording your first sale or purchase.";

  const foodTone = m.food_cost_pct === 0 ? "muted" : m.food_cost_pct <= 35 ? "green" : m.food_cost_pct <= 40 ? "amber" : "red";
  const hasTrend = m.daily_trend.length > 0;
  const hasBranch = m.branch_perf.some((b) => b.revenue > 0);

  const kpis = [
    { label: "Revenue", value: inr(m.revenue), trend: pct(m.revenue, prev.revenue) },
    { label: "Purchases", value: inr(m.purchases), trend: pct(m.purchases, prev.purchases) },
    { label: "Food Cost %", value: `${m.food_cost_pct}%`, badge: <Badge tone={foodTone as any}>{m.food_cost_pct <= 35 ? "Healthy" : m.food_cost_pct <= 40 ? "Watch" : "High"}</Badge> },
    { label: "Gross Profit", value: inr(m.gross_profit), trend: pct(m.gross_profit, prev.gross_profit) },
    { label: "Net Profit", value: inr(m.net_profit), trend: pct(m.net_profit, prev.net_profit) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone="muted">{r.label}</Badge>
            <span className="text-xs text-muted-foreground">{fmtDate(r.from)} → {fmtDate(r.to)}</span>
          </div>
        </div>
        <DateRangePicker current={key} from={r.from} to={r.to} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight">{k.value}</p>
              <div className="mt-1.5">{"trend" in k && k.trend !== undefined ? <Trend value={k.trend} /> : k.badge}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {zeroBanner && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{zeroBanner}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Daily Revenue</CardTitle></CardHeader>
          <CardContent>{hasTrend ? <RevenueTrend data={m.daily_trend} /> :
            <EmptyState icon={<LineChart className="h-8 w-8" />} title="No revenue yet" description="Upload your daily sales to see revenue trends here." primary={{ label: "Go to Sales", href: "/sales" }} />}</CardContent></Card>
        <Card><CardHeader><CardTitle>Branch Performance</CardTitle></CardHeader>
          <CardContent>{hasBranch ? <BranchPerf data={m.branch_perf} /> :
            <EmptyState icon={<BarChart3 className="h-8 w-8" />} title="No branch sales yet" description="Sales by location appear here once you upload sales." primary={{ label: "Go to Sales", href: "/sales" }} />}</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Top Sellers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {m.top_sellers.length ? m.top_sellers.map((s) => (
              <div key={s.name} className="flex justify-between text-sm"><span className="truncate">{s.name}</span><span className="font-medium tabular-nums">{inr(s.amount)}</span></div>
            )) : <EmptyState icon={<TrendingUp className="h-7 w-7" />} title="No sales yet" description="Your best sellers show up here." />}
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Least Sellers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {m.least_sellers.length ? m.least_sellers.map((s) => (
              <div key={s.name} className="flex justify-between text-sm"><span className="truncate">{s.name}</span><span className="font-medium tabular-nums">{inr(s.amount)}</span></div>
            )) : <EmptyState icon={<TrendingUp className="h-7 w-7" />} title="No sales yet" description="Slow movers show up here." />}
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Low Stock</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {m.low_stock.length ? m.low_stock.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="truncate">{s.name}</span><Badge tone="red">{s.qty} ≤ {s.reorder_level}</Badge>
              </div>
            )) : <EmptyState icon={<Package className="h-7 w-7" />} title="All stock healthy" description="No items below their reorder level." />}
          </CardContent></Card>
      </div>
    </div>
  );
}
