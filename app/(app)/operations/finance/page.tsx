import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({ title: "Finance", description: "Monthly P&L, food-cost %, prime-cost %, labour and wastage for your café.", path: "/operations/finance" });
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getActiveContext } from "@/lib/auth/session";
import { getPnl, monthRange } from "@/server/queries/finance";
import { Card, CardContent } from "@/components/ui/card";
import { inr } from "@/lib/utils";

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "warn" | "bad" }) {
  const c = tone === "good" ? "text-green-600" : tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "";
  return (
    <Card><CardContent className="pt-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${c}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </CardContent></Card>
  );
}

export default async function FinancePage() {
  const ctx = await getActiveContext();
  const { from, to } = monthRange();
  const p = await getPnl(ctx!.orgId!, ctx!.branch?.id ?? null, from, to);
  const fcTone = p.foodCostPct > 35 ? "bad" : p.foodCostPct > 30 ? "warn" : "good";
  const pcTone = p.primeCostPct > 65 ? "bad" : p.primeCostPct > 60 ? "warn" : "good";

  const rows: [string, number, boolean?][] = [
    ["Revenue", p.revenue],
    ["Food cost (purchases)", -p.purchases],
    ["Gross profit", p.grossProfit, true],
    ["Operating expenses", -p.expenses],
    ["— of which labour", -p.labour],
    ["Net profit", p.netProfit, true],
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/operations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Operations
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Finance <span className="text-sm font-normal text-muted-foreground">· this month</span></h1>
        <p className="text-sm text-muted-foreground">{from} → {to} · {ctx!.branch?.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Revenue" value={inr(p.revenue)} />
        <Metric label="Net profit" value={inr(p.netProfit)} sub={`${p.netMarginPct}% margin`} tone={p.netProfit >= 0 ? "good" : "bad"} />
        <Metric label="Food cost %" value={`${p.foodCostPct}%`} sub="target ≤ 30%" tone={fcTone} />
        <Metric label="Prime cost %" value={`${p.primeCostPct}%`} sub="food + labour · target ≤ 60%" tone={pcTone} />
        <Metric label="Labour %" value={`${p.labourPct}%`} sub={inr(p.labour)} />
        <Metric label="Wastage" value={inr(p.wastage)} />
      </div>

      <Card>
        <CardContent className="pt-5">
          <p className="mb-2 text-sm font-semibold">Profit &amp; loss</p>
          <div className="divide-y text-sm">
            {rows.map(([label, val0, strong], i) => {
              const val = val0 || 0; // normalize -0 → 0
              return (
              <div key={i} className={`flex justify-between py-2 ${strong ? "font-semibold" : label.startsWith("—") ? "pl-3 text-muted-foreground" : ""}`}>
                <span>{label}</span>
                <span className={`tabular-nums ${val < 0 ? "text-muted-foreground" : ""} ${strong && val < 0 ? "text-red-600" : ""}`}>{val < 0 ? `(${inr(-val)})` : inr(val)}</span>
              </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Food cost uses this month&apos;s <b>purchases</b> as the cost of goods (recipe-based COGS comes with the Kitchen phase). Labour is pulled from expenses in salary/wage categories.
          </p>
        </CardContent>
      </Card>

      <Link href="/expenses" className="flex items-center justify-between rounded-xl border bg-card p-4 active:scale-[.99] hover:border-primary/50">
        <div><p className="font-medium">Expenses</p><p className="text-xs text-muted-foreground">Add rent, utilities, salaries &amp; more</p></div>
        <span className="text-sm font-medium text-primary">Open →</span>
      </Link>
    </div>
  );
}
