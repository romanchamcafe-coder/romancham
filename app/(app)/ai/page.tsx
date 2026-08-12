import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({ title: "AI Analyst", description: "Romancham AI — your restaurant intelligence assistant.", path: "/ai" });
import { getActiveContext } from "@/lib/auth/session";
import { getIntelligence, monthRange } from "@/server/ai/analytics";
import { HealthScore, Briefing, InsightList, Recommendations } from "@/components/ai/panels";
import { AiChat } from "./chat";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const r1 = (n: number) => Math.round(n * 10) / 10;

function Delta({ v, invert = false }: { v: number; invert?: boolean }) {
  if (!isFinite(v) || Math.abs(v) < 0.05) return <span className="text-xs text-muted-foreground">—</span>;
  const good = invert ? v < 0 : v > 0;
  return <span className={"text-xs font-medium " + (good ? "text-emerald-600" : "text-red-600")}>{v >= 0 ? "↑" : "↓"} {r1(Math.abs(v))}%</span>;
}

export default async function AiAnalystPage() {
  const ctx = await getActiveContext();
  const range = monthRange();
  const intel = await getIntelligence(ctx!.orgId!, ctx!.branch?.id ?? null, range.from, range.to, range.label);
  const m = intel.metrics;

  const kpis = [
    { label: "Revenue", value: inr(m.revenue), delta: <Delta v={intel.deltas.revenue} /> },
    { label: "Food Cost %", value: `${r1(m.foodCostPct)}%`, delta: <Delta v={intel.deltas.foodCostPp} invert /> },
    { label: "Gross Margin", value: `${r1(m.grossMarginPct)}%`, delta: null },
    { label: "Avg Bill", value: inr(m.avgBill), delta: <Delta v={intel.deltas.avgBill} /> },
    { label: "Wastage", value: inr(m.wastageValue), delta: <Delta v={intel.deltas.wastage} invert /> },
    { label: "Inventory Value", value: inr(m.inventoryValue), delta: null },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden />
        <div>
          <h1 className="text-xl font-semibold">Romancham AI</h1>
          <p className="text-sm text-muted-foreground">Your Restaurant Intelligence Assistant · {ctx!.branch?.name} · {range.label}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <HealthScore health={intel.health} />
        <div className="lg:col-span-2"><Briefing briefing={intel.briefing} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label}><CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-lg font-bold">{k.value}</p>
            {k.delta}
          </CardContent></Card>
        ))}
      </div>

      <AiChat suggestions={[
        "How is my restaurant performing this month?",
        "Why did profit change?",
        "What is causing my food cost?",
        "Which products should I promote?",
        "Where am I losing money?",
        "What should I focus on this week?",
      ]} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="space-y-3 pt-6">
          <h2 className="font-semibold">AI Business Insights</h2>
          <InsightList insights={intel.insights} />
        </CardContent></Card>
        <Card><CardContent className="space-y-3 pt-6">
          <h2 className="font-semibold">Recommended Actions</h2>
          <Recommendations recs={intel.recommendations} />
          {intel.recommendations.length === 0 && <p className="text-sm text-muted-foreground">No urgent actions right now.</p>}
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="pt-6">
          <h2 className="mb-2 font-semibold">Best sellers</h2>
          {intel.topSellers.length ? (
            <ul className="space-y-1 text-sm">{intel.topSellers.slice(0, 6).map((s, i) => (
              <li key={i} className="flex justify-between"><span>{s.name}</span><span className="tabular-nums text-muted-foreground">{s.qty} · {inr(s.amount)}</span></li>
            ))}</ul>
          ) : <p className="text-sm text-muted-foreground">No sales in this period.</p>}
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <h2 className="mb-2 font-semibold">Under-performing items</h2>
          {intel.leastSellers.length ? (
            <ul className="space-y-1 text-sm">{intel.leastSellers.slice(0, 6).map((s, i) => (
              <li key={i} className="flex justify-between"><span>{s.name}</span><span className="tabular-nums text-muted-foreground">{s.qty} · {inr(s.amount)}</span></li>
            ))}</ul>
          ) : <p className="text-sm text-muted-foreground">No sales in this period.</p>}
        </CardContent></Card>
      </div>

      <Card><CardContent className="pt-6">
        <p className="text-xs font-medium text-muted-foreground">Data used</p>
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">{intel.dataUsed.map((d, i) => <li key={i}>· {d}</li>)}</ul>
      </CardContent></Card>
    </div>
  );
}
