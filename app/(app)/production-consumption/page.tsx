import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getPncOverview } from "@/server/queries/pnc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/utils";
import { Factory, ArrowRightLeft, Trash2, ClipboardList, BarChart3, AlertTriangle } from "lucide-react";
import { DayCloseBar } from "./day-close-bar";
import { SyncSalesButton } from "./sync-sales-button";

export const metadata: Metadata = pageMetadata({ title: "Production & Consumption", description: "Produce batches, move stock Store→Display, record wastage, count stock, and reconcile production against sales.", path: "/production-consumption" });

const tiles = [
  { href: "/production-consumption/production", label: "Production Log", desc: "Record a batch — consumes raw, adds finished stock to Store.", icon: Factory },
  { href: "/production-consumption/transfer", label: "Stock Transfer", desc: "Move finished stock Store → Display (FIFO).", icon: ArrowRightLeft },
  { href: "/production-consumption/wastage", label: "Wastage Entry", desc: "Write off finished stock with a reason code.", icon: Trash2 },
  { href: "/production-consumption/count", label: "Physical Count", desc: "Blind count; variance revealed after you submit.", icon: ClipboardList },
  { href: "/production-consumption/report", label: "Consumption Report", desc: "Raw usage, finished movement, production vs sales.", icon: BarChart3 },
];

export default async function PncHubPage() {
  const ctx = await getActiveContext();
  const o = await getPncOverview(ctx!.orgId!, ctx!.branch?.id ?? null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Production &amp; Consumption <span className="text-sm font-normal text-muted-foreground">· {ctx!.branch?.name}</span></h1>
          <p className="text-sm text-muted-foreground">Flow: <b>Production → Store → Display → Sold</b>, with wastage tracked at every step. Stock is an immutable ledger — every movement is a transaction.</p>
        </div>
        <SyncSalesButton />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="In Store (value)" value={inr(o.storeValue)} />
        <Kpi label="On Display (value)" value={inr(o.displayValue)} />
        <Kpi label="Produced today (units)" value={String(Math.round(o.producedToday * 100) / 100)} />
        <Kpi label="Wastage today" value={inr(o.wastageToday)} tone={o.wastageToday > 0 ? "amber" : "muted"} />
        <Kpi label="Production efficiency" value={`${Math.round(o.efficiency)}%`} sub="actual yield ÷ planned" />
        <Kpi label="Day status" value={o.dayClosed ? "Closed" : "Open"} tone={o.dayClosed ? "muted" : "green"} />
      </div>

      {o.exceptions.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-500/40">
          <CardContent className="space-y-2 pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300"><AlertTriangle className="h-4 w-4" /> POS exceptions ({o.exceptions.length})</div>
            <div className="space-y-1 text-sm">
              {o.exceptions.slice(0, 6).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2">
                  <span>{e.date} · <b>{e.item}</b> ({e.qty}) — {e.reason === "unmapped" ? "no matching item" : "sold more than transferred"}</span>
                  <Badge tone="amber">{e.reason}</Badge>
                </div>
              ))}
            </div>
            <p className="pt-1 text-xs text-muted-foreground">Resolve unmapped items in <Link href="/masters/ingredients" className="text-primary underline">Ingredients</Link>, then re-sync. Oversold items need a transfer to Display.</p>
          </CardContent>
        </Card>
      )}

      {o.nearExpiry.length > 0 && (
        <Card className="border-red-300 dark:border-red-500/40"><CardContent className="space-y-1 pt-4">
          <div className="text-sm font-medium text-red-700 dark:text-red-300">Expiring within 3 days</div>
          {o.nearExpiry.map((b, i) => <div key={i} className="text-sm">{b.name} · batch {b.code} — <b>{b.expiresInDays}d</b></div>)}
        </CardContent></Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="space-y-1 pt-5">
                <t.icon className="h-5 w-5 text-primary" />
                <div className="font-medium">{t.label}</div>
                <p className="text-sm text-muted-foreground">{t.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <DayCloseBar businessDate={today} closed={o.dayClosed} />
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "muted" | "green" | "amber" }) {
  return (
    <Card><CardContent className="pt-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : tone ? <Badge tone={tone}>{tone === "green" ? "OK" : ""}</Badge> : null}
    </CardContent></Card>
  );
}
