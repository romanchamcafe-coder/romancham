import type { Metadata } from "next";
export const metadata: Metadata = { title: "Inventory | Romancham" };
import { getActiveContext } from "@/lib/auth/session";
import { getInventory, getFinishedGoods, getAdjustItems } from "@/server/queries/inventory";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AdjustForm } from "./adjust-form";
import { inr } from "@/lib/utils";

export default async function InventoryPage() {
  const ctx = await getActiveContext();
  const rows = await getInventory(ctx!.orgId!, ctx!.branch?.id ?? null);
  const finished = await getFinishedGoods(ctx!.orgId!, ctx!.branch?.id ?? null);
  const items = await getAdjustItems(ctx!.orgId!);

  const lowCount = rows.filter((r) => r.status === "low" || r.status === "out").length;
  const totalValue = rows.reduce((s, r) => s + r.value, 0);

  const badge = (s: string) =>
    s === "out" ? <Badge tone="red">Out of stock</Badge> :
    s === "low" ? <Badge tone="amber">Low</Badge> :
    <Badge tone="green">OK</Badge>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inventory <span className="text-sm font-normal text-muted-foreground">· {ctx!.branch?.name}</span></h1>
        <AdjustForm items={items} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Items tracked</p><p className="mt-1 text-2xl font-bold">{rows.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Low / out of stock</p><p className="mt-1 text-2xl font-bold">{lowCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Stock value (FIFO)</p><p className="mt-1 text-2xl font-bold">{inr(totalValue)}</p></CardContent></Card>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <THead><TR><TH>Ingredient</TH><TH>Category</TH><TH>UOM</TH><TH className="text-right">In Hand</TH><TH className="text-right">Stock Value</TH><TH className="text-right">Reorder</TH><TH>Status</TH></TR></THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.name}</TD>
                <TD>{r.category}</TD>
                <TD>{r.uom}</TD>
                <TD className="text-right tabular-nums">{r.qty} {r.uom}</TD>
                <TD className="text-right tabular-nums">{inr(r.value)}</TD>
                <TD className="text-right tabular-nums">{r.reorder || "—"}</TD>
                <TD>{badge(r.status)}</TD>
              </TR>
            ))}
            {rows.length === 0 && <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">No purchase items yet. Add items in Ingredients and record a Purchase to see stock here.</TD></TR>}
          </TBody>
        </Table>
      </Card>

      {finished.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Finished goods <span className="font-normal text-muted-foreground">· made-to-stock items (e.g. ice cream). Added via <Link href="/production" className="text-primary underline">Production</Link>, deducted on sale.</span></h2>
          <Card className="overflow-x-auto">
            <Table>
              <THead><TR><TH>Finished good</TH><TH>UOM</TH><TH className="text-right">In Hand</TH><TH className="text-right">Reorder</TH><TH>Status</TH></TR></THead>
              <TBody>
                {finished.map((f) => (
                  <TR key={f.id}>
                    <TD className="font-medium">{f.name}</TD>
                    <TD>{f.uom}</TD>
                    <TD className="text-right tabular-nums">{f.qty} {f.uom}</TD>
                    <TD className="text-right tabular-nums">{f.reorder || "—"}</TD>
                    <TD>{badge(f.status)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
