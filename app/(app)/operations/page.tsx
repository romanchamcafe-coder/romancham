import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({ title: "Operations", description: "Daily checklists, inventory requests, wastage and finance — your operations hub.", path: "/operations" });
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getOpsOverview } from "@/server/queries/operations";
import { getInventoryCounts } from "@/server/queries/requests";
import { getTaskStats } from "@/server/queries/tasks";
import { Card, CardContent } from "@/components/ui/card";
import { inr } from "@/lib/utils";
import { ClipboardCheck, Trash2, CheckCircle2, Circle, PackageCheck, ShoppingBag, TrendingUp, Wallet, ListChecks } from "lucide-react";

export default async function OperationsPage() {
  const ctx = await getActiveContext();
  const [o, inv, tasks] = await Promise.all([
    getOpsOverview(ctx!.orgId!, ctx!.branch?.id ?? null),
    getInventoryCounts(ctx!.orgId!, ctx!.branch?.id ?? null),
    getTaskStats(ctx!.orgId!, ctx!.branch?.id ?? null),
  ]);

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

      {/* Tasks */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4 text-primary" /> Tasks</div>
        <Link href="/operations/tasks"
          className="flex items-center justify-between rounded-xl border bg-card p-4 transition active:scale-[.99] hover:border-primary/50">
          <div>
            <p className="font-medium">Team tasks</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tasks.total === 0 ? "Assign opening, cleaning, maintenance & more"
                : `${tasks.done}/${tasks.total} done · ${tasks.pct}%${tasks.overdue ? ` · ${tasks.overdue} overdue` : ""}`}
            </p>
          </div>
          {tasks.overdue > 0
            ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{tasks.overdue} overdue</span>
            : tasks.open > 0
              ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{tasks.open} open</span>
              : <span className="text-sm font-medium text-primary">Open →</span>}
        </Link>
      </div>

      {/* Inventory & requests */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><PackageCheck className="h-4 w-4 text-primary" /> Inventory &amp; requests</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/operations/indents"
            className="flex items-center justify-between rounded-xl border bg-card p-4 transition active:scale-[.99] hover:border-primary/50">
            <div>
              <p className="font-medium">Indents</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Internal stock requests</p>
            </div>
            {inv.pendingIndents > 0
              ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{inv.pendingIndents} pending</span>
              : <span className="text-sm font-medium text-primary">Open →</span>}
          </Link>
          <Link href="/operations/purchase-requests"
            className="flex items-center justify-between rounded-xl border bg-card p-4 transition active:scale-[.99] hover:border-primary/50">
            <div>
              <p className="font-medium">Purchase requests</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Buy stock from a vendor</p>
            </div>
            {inv.pendingPRs > 0
              ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{inv.pendingPRs} pending</span>
              : <span className="text-sm font-medium text-primary">Open →</span>}
          </Link>
        </div>
        {inv.low > 0 && (
          <Link href="/operations/indents" className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 active:scale-[.99]">
            <ShoppingBag className="h-4 w-4" /> <b>{inv.low}</b> item{inv.low > 1 ? "s" : ""} at or below reorder level — tap to raise an indent.
          </Link>
        )}
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

      {/* Finance */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Finance</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/operations/finance"
            className="flex items-center justify-between rounded-xl border bg-card p-4 transition active:scale-[.99] hover:border-primary/50">
            <div>
              <p className="font-medium">P&amp;L this month</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Revenue, food cost %, profit</p>
            </div>
            <TrendingUp className="h-5 w-5 shrink-0 text-primary" />
          </Link>
          <Link href="/operations/cash"
            className="flex items-center justify-between rounded-xl border bg-card p-4 transition active:scale-[.99] hover:border-primary/50">
            <div>
              <p className="font-medium">Cash reconciliation</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Count the drawer against POS</p>
            </div>
            <Wallet className="h-5 w-5 shrink-0 text-primary" />
          </Link>
        </div>
      </div>
    </div>
  );
}
