import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getActiveContext } from "@/lib/auth/session";
import { getMenuEngineering } from "@/server/queries/menu";
import { computePricing } from "@/lib/menu-pricing";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { MenuEngineering } from "./menu-engineering";
import { inr } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({ title: "Menu Engineering", description: "Derive dine-in, takeaway and delivery prices from recipe cost, overheads, commission, GST and target profit.", path: "/menu-engineering" });

export default async function MenuEngineeringPage() {
  const ctx = await getActiveContext();
  const items = await getMenuEngineering(ctx!.orgId!);
  const priced = items.filter((i) => i.pricing);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Menu Engineering</h1>
        <p className="text-sm text-muted-foreground">Build your selling price for each product from recipe cost plus packaging, wastage, labour, utilities, overhead, marketing, commission, GST and target profit — for dine-in, takeaway and delivery.</p>
      </div>

      <MenuEngineering items={items} />

      <Card className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Sales Item</TH>
              <TH className="text-right">Recipe Cost</TH>
              <TH className="text-right">Target Profit</TH>
              <TH className="text-right">Dine-in</TH>
              <TH className="text-right">Takeaway</TH>
              <TH className="text-right">Delivery</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((i) => {
              if (!i.pricing) {
                return (
                  <TR key={i.id}>
                    <TD className="font-medium">{i.name}</TD>
                    <TD className="text-right tabular-nums">{inr(Math.round(i.recipeCost))}</TD>
                    <TD colSpan={4} className="text-right text-muted-foreground">— not priced yet —</TD>
                  </TR>
                );
              }
              const p = i.pricing;
              const r = computePricing({
                recipeCost: i.recipeCost, packaging: p.packaging_cost, wastage: p.wastage_pct, labor: p.labor_cost,
                utility: p.utility_cost, overhead: p.overhead_cost, marketing: p.marketing_cost,
                commission: p.commission_pct, targetProfit: p.target_profit_pct, gst: p.gst_pct,
              });
              return (
                <TR key={i.id}>
                  <TD className="font-medium">{i.name}</TD>
                  <TD className="text-right tabular-nums">{inr(Math.round(i.recipeCost))}</TD>
                  <TD className="text-right tabular-nums">{p.target_profit_pct}%</TD>
                  <TD className="text-right font-medium tabular-nums">{inr(Math.round(r.dinePrice))}</TD>
                  <TD className="text-right font-medium tabular-nums">{inr(Math.round(r.takeawayPrice))}</TD>
                  <TD className="text-right font-medium tabular-nums">{inr(Math.round(r.deliveryPrice))}</TD>
                </TR>
              );
            })}
            {items.length === 0 && <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Add Sales items (in Ingredients) to price them here.</TD></TR>}
            {items.length > 0 && priced.length === 0 && <TR><TD colSpan={6} className="py-3 text-center text-xs text-muted-foreground">Pick an item above and Save pricing to populate this table.</TD></TR>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
