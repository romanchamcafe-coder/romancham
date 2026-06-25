import { getActiveContext } from "@/lib/auth/session";
import { getDashboard } from "@/server/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueTrend, BranchPerf } from "@/components/charts/dashboard-charts";
import { inr } from "@/lib/utils";

export default async function DashboardPage() {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return null;

  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const m = await getDashboard(ctx.orgId, ctx.branch?.id ?? null, from, to);

  const kpis = [
    { label: "Revenue", value: inr(m.revenue) },
    { label: "Purchases", value: inr(m.purchases) },
    { label: "Food Cost %", value: `${m.food_cost_pct}%` },
    { label: "Gross Profit", value: inr(m.gross_profit) },
    { label: "Net Profit", value: inr(m.net_profit) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard <span className="text-sm font-normal text-muted-foreground">· last 30 days</span></h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-2xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Daily Revenue</CardTitle></CardHeader>
          <CardContent>{m.daily_trend.length ? <RevenueTrend data={m.daily_trend} /> : <Empty />}</CardContent></Card>
        <Card><CardHeader><CardTitle>Branch Performance</CardTitle></CardHeader>
          <CardContent>{m.branch_perf.length ? <BranchPerf data={m.branch_perf} /> : <Empty />}</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Top Sellers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {m.top_sellers.length ? m.top_sellers.map((s) => (
              <div key={s.name} className="flex justify-between text-sm"><span>{s.name}</span><span className="font-medium">{inr(s.amount)}</span></div>
            )) : <Empty />}
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Least Sellers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {m.least_sellers.length ? m.least_sellers.map((s) => (
              <div key={s.name} className="flex justify-between text-sm"><span>{s.name}</span><span className="font-medium">{inr(s.amount)}</span></div>
            )) : <Empty />}
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Low Stock</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {m.low_stock.length ? m.low_stock.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span>{s.name}</span><Badge tone="red">{s.qty} ≤ {s.reorder_level}</Badge>
              </div>
            )) : <p className="text-sm text-muted-foreground">All stock healthy ✅</p>}
          </CardContent></Card>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-muted-foreground">No data yet — add sales & purchases.</p>;
}
