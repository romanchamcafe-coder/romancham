import type { Intelligence, Insight, Severity } from "@/server/ai/analytics";
import { Card, CardContent } from "@/components/ui/card";

const dot: Record<Severity, string> = {
  critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-400", positive: "bg-emerald-500",
};
const ring: Record<Severity, string> = {
  critical: "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40",
  high: "border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/40",
  medium: "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/40",
  positive: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40",
};
const label: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Attention", positive: "Positive" };

export function InsightList({ insights, limit }: { insights: Insight[]; limit?: number }) {
  const items = limit ? insights.slice(0, limit) : insights;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No issues detected for this period. Record more sales, purchases and wastage to sharpen the analysis.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.id} className={"rounded-lg border p-3 " + ring[i.severity]}>
          <div className="flex items-start gap-2">
            <span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + dot[i.severity]} aria-hidden />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label[i.severity]}</span>
                <span className="font-medium">{i.title}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{i.detail}</p>
              {i.impact && <p className="mt-0.5 text-sm font-medium text-foreground">Impact: {i.impact}</p>}
              {i.action && <p className="mt-1 text-sm"><span className="font-medium">Action:</span> {i.action}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HealthScore({ health }: { health: Intelligence["health"] }) {
  const color = health.score >= 80 ? "text-emerald-600" : health.score >= 60 ? "text-amber-600" : "text-red-600";
  const bar = health.score >= 80 ? "bg-emerald-500" : health.score >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">Restaurant Health</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={"text-4xl font-bold " + color}>{health.score}</span>
          <span className="text-sm text-muted-foreground">/ 100 · {health.band}</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={"h-full " + bar} style={{ width: `${health.score}%` }} />
        </div>
        {health.components.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {health.components.map((c, idx) => (
              <li key={idx} className="flex items-center justify-between">
                <span className="text-muted-foreground">{c.label}</span>
                <span className={"font-medium tabular-nums " + (c.points >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {c.points >= 0 ? "+" : ""}{c.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function Briefing({ briefing }: { briefing: Intelligence["briefing"] }) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <p className="text-sm font-semibold">Daily AI Briefing</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div><span className="text-muted-foreground">Sales today </span><span className="font-medium">₹{Math.round(briefing.salesToday).toLocaleString("en-IN")}</span></div>
          <div><span className="text-muted-foreground">Food cost </span><span className="font-medium">{Math.round(briefing.foodCostToday * 10) / 10}%</span></div>
        </div>
        {briefing.lines.map((l, i) => <p key={i} className="text-sm">{l}</p>)}
        {briefing.actions.length > 0 && (
          <div>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Recommended actions today</p>
            <ol className="ml-4 list-decimal text-sm">{briefing.actions.map((a, i) => <li key={i}>{a}</li>)}</ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Recommendations({ recs }: { recs: Intelligence["recommendations"] }) {
  if (recs.length === 0) return null;
  const pri: Record<string, string> = { HIGH: "text-red-600", MEDIUM: "text-amber-600", LOW: "text-muted-foreground" };
  return (
    <div className="space-y-2">
      {recs.map((r, i) => (
        <div key={i} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{r.problem}</span>
            <span className={"text-xs font-semibold " + (pri[r.priority] ?? "")}>{r.priority}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">Evidence: {r.evidence}</p>
          {r.cause && <p className="text-sm text-muted-foreground">Likely cause: {r.cause}</p>}
          {r.impact && <p className="text-sm text-muted-foreground">Impact: {r.impact}</p>}
          <p className="mt-1 text-sm"><span className="font-medium">Action:</span> {r.action}</p>
        </div>
      ))}
    </div>
  );
}
