import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getProductionScreen } from "@/server/queries/pnc";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/utils";
import { ProductionLogForm } from "./production-log-form";

export const metadata: Metadata = pageMetadata({ title: "Production Log", description: "Record a batch of a finished good — consumes raw materials and adds finished stock to Store.", path: "/production-consumption/production" });

export default async function ProductionLogPage() {
  const ctx = await getActiveContext();
  const { items, recent } = await getProductionScreen(ctx!.orgId!, ctx!.branch?.id ?? null);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/production-consumption" className="text-xs text-muted-foreground hover:underline">← Production &amp; Consumption</Link>
        <h1 className="text-xl font-semibold">Production Log</h1>
        <p className="text-sm text-muted-foreground">Pick a finished good, load its recipe, enter what you actually made. Raw materials are consumed and finished stock is added to <b>Store</b>.</p>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          No batch-produced items yet. In <Link href="/masters/ingredients?type=sales" className="text-primary underline">Ingredients</Link>, set a Sales item&apos;s <b>Fulfillment</b> to &quot;Made to stock&quot;, then add its recipe in <Link href="/recipes" className="text-primary underline">Recipes</Link>.
        </CardContent></Card>
      ) : (
        <ProductionLogForm items={items} />
      )}

      {recent.length > 0 && (
        <Card className="overflow-x-auto">
          <div className="border-b px-4 py-2 text-sm font-medium">Recent batches</div>
          <Table>
            <THead><TR><TH>Date</TH><TH>Batch</TH><TH>Item</TH><TH className="text-right">Yield</TH><TH className="text-right">Raw cost</TH><TH className="text-right">Cost/unit</TH><TH>Expiry</TH></TR></THead>
            <TBody>
              {recent.map((r) => (
                <TR key={r.id}>
                  <TD>{r.date}</TD>
                  <TD className="font-mono text-xs">{r.code}</TD>
                  <TD className="font-medium">{r.name}</TD>
                  <TD className="text-right tabular-nums">{r.yield}</TD>
                  <TD className="text-right tabular-nums">{inr(r.cost)}</TD>
                  <TD className="text-right tabular-nums">{inr(r.cpu)}</TD>
                  <TD>{r.expiry ? (r.expiresInDays != null && r.expiresInDays <= 3 ? <Badge tone="red">{r.expiry}</Badge> : r.expiry) : <span className="text-muted-foreground">—</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
