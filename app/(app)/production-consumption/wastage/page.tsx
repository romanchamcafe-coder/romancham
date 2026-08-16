import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getWastageScreen } from "@/server/queries/pnc";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { inr } from "@/lib/utils";
import { WastageForm } from "./wastage-form";

export const metadata: Metadata = pageMetadata({ title: "Wastage Entry", description: "Write off finished stock with a mandatory reason code and live value.", path: "/production-consumption/wastage" });

const REASON_LABEL: Record<string, string> = {
  expired: "Expired", over_portioned: "Over-portioned", staff_meal: "Staff meal", complimentary: "Complimentary",
  damaged: "Damaged", trial_batch: "Trial batch", customer_return: "Customer return", quality_rejection: "Quality rejection",
};

export default async function WastagePage() {
  const ctx = await getActiveContext();
  const { items, recent } = await getWastageScreen(ctx!.orgId!, ctx!.branch?.id ?? null);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/production-consumption" className="text-xs text-muted-foreground hover:underline">← Production &amp; Consumption</Link>
        <h1 className="text-xl font-semibold">Wastage Entry</h1>
        <p className="text-sm text-muted-foreground">Record finished stock that was wasted. A <b>reason code</b> is required and the value lost is shown live.</p>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">No batch-produced items yet.</CardContent></Card>
      ) : (
        <WastageForm items={items} />
      )}

      {recent.length > 0 && (
        <Card className="overflow-x-auto">
          <div className="border-b px-4 py-2 text-sm font-medium">Recent wastage</div>
          <Table>
            <THead><TR><TH>Date</TH><TH>Item</TH><TH>Location</TH><TH className="text-right">Qty</TH><TH>Reason</TH><TH className="text-right">Value lost</TH></TR></THead>
            <TBody>
              {recent.map((r) => (
                <TR key={r.id}>
                  <TD>{r.date}</TD>
                  <TD className="font-medium">{r.name}</TD>
                  <TD className="capitalize">{r.location}</TD>
                  <TD className="text-right tabular-nums">{r.qty}</TD>
                  <TD>{REASON_LABEL[r.reason] ?? r.reason}</TD>
                  <TD className="text-right tabular-nums">{inr(r.value)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
