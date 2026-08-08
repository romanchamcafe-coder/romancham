import type { Metadata } from "next";
import { getActiveContext } from "@/lib/auth/session";
import { getReport, REPORT_DEFS } from "@/server/queries/reports";
import { monthRange } from "@/server/queries/finance";
import { pageMetadata } from "@/lib/seo";
import { ReportControls } from "./report-controls";
import { ReportView } from "./report-view";

export const metadata: Metadata = pageMetadata({
  title: "Reports",
  description: "Sales, purchases, inventory, P&L, wastage and compliance reports with export.",
  path: "/reports",
});

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; from?: string; to?: string }>;
}) {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return null;
  const sp = await searchParams;
  const m = monthRange();
  const report = REPORT_DEFS.some((d) => d.key === sp.report) ? sp.report! : "sales_daily";
  const from = sp.from || m.from;
  const to = sp.to || m.to;
  const def = REPORT_DEFS.find((d) => d.key === report)!;

  const data = await getReport(report, ctx.orgId, ctx.branch?.id ?? null, from, to);

  return (
    <div className="space-y-4">
      <div className="no-print">
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Filter by date range and branch, then export to CSV or print/PDF. Branch: {ctx.branch?.name ?? "All"}.
        </p>
      </div>

      <div className="no-print">
        <ReportControls report={report} from={from} to={to} />
      </div>

      <ReportView title={def.label} branch={ctx.branch?.name ?? "All branches"} from={from} to={to} data={data} />
    </div>
  );
}
