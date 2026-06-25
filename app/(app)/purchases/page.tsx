import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getPurchases } from "@/server/queries/purchases";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/utils";

export default async function PurchasesPage() {
  const ctx = await getActiveContext();
  const rows = await getPurchases(ctx!.orgId!, ctx!.branch?.id ?? null);
  const tone: Record<string, "green" | "amber" | "red"> = { paid: "green", partial: "amber", unpaid: "red" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchases</h1>
        <Link href="/purchases/new"><Button>+ New Purchase</Button></Link>
      </div>
      <Card>
        <Table>
          <THead>
            <TR><TH>Bill No</TH><TH>Date</TH><TH>Vendor</TH><TH>GST</TH><TH>Total</TH><TH>Payment</TH></TR>
          </THead>
          <TBody>
            {rows.map((p: any) => (
              <TR key={p.id}>
                <TD className="font-medium">{p.bill_no ?? "—"}</TD>
                <TD>{p.bill_date}</TD>
                <TD>{p.vendors?.name ?? "—"}</TD>
                <TD>{inr((p.cgst ?? 0) + (p.sgst ?? 0) + (p.igst ?? 0))}</TD>
                <TD className="font-medium">{inr(p.total)}</TD>
                <TD><Badge tone={tone[p.payment_status] ?? "muted"}>{p.payment_status}</Badge></TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">No purchases yet. Click &quot;New Purchase&quot; to record your first bill.</TD></TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
