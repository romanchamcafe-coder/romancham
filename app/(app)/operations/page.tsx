import type { Metadata } from "next";
export const metadata: Metadata = { title: "Operations | Romancham" };
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getOpsOverview } from "@/server/queries/operations";
import { Card, CardContent } from "@/components/ui/card";
import { inr } from "@/lib/utils";
import { ClipboardCheck, Trash2, CheckCircle2, Circle } from "lucide-react";

export default async function OperationsPage() {
  const ctx = await getActiveContext();
  const o = await getOpsOverview(ctx!.orgId!, ctx!.branch?.id ?? null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Operations <span className="text-sm font-normal text-muted-foreground">· {ctx!.branch?.name}</span></h1>
        <p className="text-sm text-muted-foreground">Daily checklists and wastage — quick taps, done in under a minute.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Checklists today</p><p className="mt-1 text-2xl font-bold">{o.completedToday}<span className="text-base font-normal text-muted-foreground">/{o.checklists.length}</span></p><p className="text-xs text-muted-foreground">{o.completionPct}% done</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Wastage today</p><p className="mt-1 text-2xl font-bold">{inr(o.wastage.today)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Wastage this week</p><p className="mt-1 text-2xl font-bold">{inr(o.wastage.week)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Wastage this month</p><p className="mt-1 text-2xl font-bold">{inr(o.wastage.month)}</p></CardContent></Card>
      </div>

      {/* Checklists */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4 text-primary" /> Daily checklists</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {o.checklists.map((c) => (
            <Link key={c.type} href={`/operations/checklist/${c.type}`}
              className="rounded-xl border bg-card p-4 transition active:scale-[.99] hover:border-primary/50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.doneToday ? `${c.done}/${c.total} · ${c.score}%` : `${c.total} items`}</p>
                </div>
                {c.doneToday
                  ? <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
                  : <Circle className="h-6 w-6 shrink-0 text-muted-foreground/40" />}
              </div>
              <p className={`mt-3 text-sm font-medium ${c.doneToday ? "text-green-600" : "text-primary"}`}>
                {c.doneToday ? "Done today · tap to review" : "Tap to start →"}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Wastage */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Trash2 className="h-4 w-4 text-primary" /> Wastage</div>
        <Link href="/operations/wastage"
          className="flex items-center justify-between rounded-xl border bg-card p-4 transition active:scale-[.99] hover:border-primary/50">
          <div>
            <p className="font-medium">Log &amp; review wastage</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{inr(o.wastage.today)} logged today</p>
          </div>
          <span className="text-sm font-medium text-primary">Open →</span>
        </Link>
      </div>
    </div>
  );
}
