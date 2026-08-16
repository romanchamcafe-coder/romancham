import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getConsumptionReport } from "@/server/queries/pnc";
import { ReportTabs } from "./report-tabs";
import { ReportRange } from "./report-range";

export const metadata: Metadata = pageMetadata({ title: "Consumption Report", description: "Raw material consumption, finished goods movement, and production vs sales reconciliation.", path: "/production-consumption/report" });

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await getActiveContext();
  const sp = await searchParams;
  const to = sp.to || new Date().toISOString().slice(0, 10);
  const from = sp.from || new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const data = await getConsumptionReport(ctx!.orgId!, ctx!.branch?.id ?? null, from, to);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/production-consumption" className="text-xs text-muted-foreground hover:underline">← Production &amp; Consumption</Link>
        <h1 className="text-xl font-semibold">Consumption Report</h1>
        <p className="text-sm text-muted-foreground">Raw usage vs physical stock, finished-goods movement by batch, and how production compares with what actually sold.</p>
      </div>
      <ReportRange from={from} to={to} />
      <ReportTabs raw={data.raw} finished={data.finished} recon={data.recon} />
    </div>
  );
}
