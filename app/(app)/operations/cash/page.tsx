import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({ title: "Cash Reconciliation", description: "Count the drawer against POS cash sales and record daily cash variance.", path: "/operations/cash" });
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getActiveContext } from "@/lib/auth/session";
import { getCashRecon } from "@/server/queries/finance";
import { CashForm } from "./cash-form";
import { inr } from "@/lib/utils";

export default async function CashPage() {
  const ctx = await getActiveContext();
  const { row, cashSalesToday, recent } = await getCashRecon(ctx!.orgId!, ctx!.branch?.id ?? null);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/operations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Operations
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Cash reconciliation <span className="text-sm font-normal text-muted-foreground">· today</span></h1>
        <p className="text-sm text-muted-foreground">Count the drawer and check it against expected cash.</p>
      </div>

      <CashForm cashSalesToday={cashSalesToday} existing={row as any} />

      {recent.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Recent days</p>
          {recent.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
              <span>{r.recon_date}</span>
              <span className="text-muted-foreground">exp {inr(r.expected)} · counted {inr(r.counted)}</span>
              <span className={`font-semibold tabular-nums ${Number(r.variance) === 0 ? "text-green-600" : Math.abs(Number(r.variance)) < 50 ? "text-amber-600" : "text-red-600"}`}>
                {Number(r.variance) > 0 ? "+" : ""}{inr(r.variance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
