import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({ title: "Production", description: "Record production batches that consume raw materials and add finished goods.", path: "/production" });
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getProductionData } from "@/server/queries/production";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProductionForm } from "./production-form";

export default async function ProductionPage() {
  const ctx = await getActiveContext();
  const { stockItems, recent } = await getProductionData(ctx!.orgId!, ctx!.branch?.id ?? null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Production <span className="text-sm font-normal text-muted-foreground">· {ctx!.branch?.name}</span></h1>
      <p className="text-sm text-muted-foreground">
        Record a batch of a <b>made-to-stock</b> finished good (like ice cream). Each batch <b>consumes raw materials</b> via its recipe and <b>adds finished-goods stock</b>. When you sell it, stock is deducted from the freezer — not the raw materials.
      </p>

      {stockItems.length === 0 ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          No made-to-stock items yet. In <Link href="/masters/ingredients?type=sales" className="text-primary underline">Ingredients</Link>, set a Sales item&apos;s <b>Fulfillment</b> to &quot;Made to stock&quot;, then add its recipe in <Link href="/recipes" className="text-primary underline">Recipes</Link>.
        </CardContent></Card>
      ) : (
        <>
          <ProductionForm items={stockItems} />

          <Card className="overflow-x-auto">
            <Table>
              <THead><TR><TH>Finished good</TH><TH className="text-right">In freezer</TH><TH>Recipe</TH></TR></THead>
              <TBody>
                {stockItems.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.name}</TD>
                    <TD className="text-right tabular-nums">{s.onHand} {s.uom}</TD>
                    <TD>{s.components > 0 ? <Badge tone="green">{s.components} ingredient{s.components > 1 ? "s" : ""}</Badge> : <Badge tone="amber">No recipe</Badge>}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </>
      )}

      {recent.length > 0 && (
        <Card className="overflow-x-auto">
          <div className="border-b px-4 py-2 text-sm font-medium">Recent batches</div>
          <Table>
            <THead><TR><TH>Date</TH><TH>Finished good</TH><TH className="text-right">Qty</TH><TH>Note</TH></TR></THead>
            <TBody>
              {recent.map((r) => (
                <TR key={r.id}>
                  <TD>{r.produced_on}</TD>
                  <TD className="font-medium">{r.name}</TD>
                  <TD className="text-right tabular-nums">{r.qty}</TD>
                  <TD className="text-muted-foreground">{r.note || "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
