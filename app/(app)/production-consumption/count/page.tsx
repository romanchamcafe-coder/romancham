import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getCountScreen } from "@/server/queries/pnc";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/utils";
import { CountForm } from "./count-form";
import { ApproveButton } from "./approve-button";

export const metadata: Metadata = pageMetadata({ title: "Physical Count", description: "Blind stock count — the system quantity is hidden until you submit, then the variance is revealed.", path: "/production-consumption/count" });

export default async function CountPage() {
  const ctx = await getActiveContext();
  const { items, recent } = await getCountScreen(ctx!.orgId!, ctx!.branch?.id ?? null);
  const canApprove = ctx!.role === "owner" || ctx!.role === "manager";

  return (
    <div className="space-y-4">
      <div>
        <Link href="/production-consumption" className="text-xs text-muted-foreground hover:underline">← Production &amp; Consumption</Link>
        <h1 className="text-xl font-semibold">Physical Count</h1>
        <p className="text-sm text-muted-foreground"><b>Blind count:</b> you won&apos;t see the system quantity while counting. Enter what you physically count; the variance is revealed after you submit. Approving a count posts an adjustment to the ledger.</p>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">No batch-produced items to count yet.</CardContent></Card>
      ) : (
        <CountForm items={items} />
      )}

      {recent.length > 0 && (
        <Card className="overflow-x-auto">
          <div className="border-b px-4 py-2 text-sm font-medium">Recent counts</div>
          <Table>
            <THead><TR><TH>Date</TH><TH>Item</TH><TH>Location</TH><TH className="text-right">System</TH><TH className="text-right">Counted</TH><TH className="text-right">Variance</TH><TH className="text-right">Value</TH><TH>Status</TH></TR></THead>
            <TBody>
              {recent.map((r) => (
                <TR key={r.id}>
                  <TD>{r.date}</TD>
                  <TD className="font-medium">{r.name}</TD>
                  <TD className="capitalize">{r.location}</TD>
                  <TD className="text-right tabular-nums">{r.system}</TD>
                  <TD className="text-right tabular-nums">{r.counted}</TD>
                  <TD className={"text-right tabular-nums " + (r.variance < 0 ? "text-red-600 dark:text-red-400" : r.variance > 0 ? "text-emerald-600 dark:text-emerald-400" : "")}>{r.variance > 0 ? "+" : ""}{r.variance}</TD>
                  <TD className="text-right tabular-nums">{inr(r.value)}</TD>
                  <TD>
                    {r.status === "approved" ? <Badge tone="green">Approved</Badge>
                      : canApprove ? <ApproveButton id={r.id} /> : <Badge tone="amber">Pending</Badge>}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
