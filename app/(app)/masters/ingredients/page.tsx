import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getMaterialFormData, getMaterials } from "@/server/queries/masters";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { IngredientForm } from "./ingredient-form";
import { cn } from "@/lib/utils";

const typeLabel: Record<string, string> = { purchase: "Purchase", sales: "Sales", both: "Both" };

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await getActiveContext();
  const { type } = await searchParams;
  const active = type === "purchase" || type === "sales" ? type : "all";
  const { categories, units, vendors } = await getMaterialFormData(ctx!.orgId!);
  const items = await getMaterials(ctx!.orgId!, active === "all" ? undefined : active);

  const tabs = [["all", "All"], ["purchase", "Purchase"], ["sales", "Sales"]] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Item Name</h1>
      <p className="text-sm text-muted-foreground">Your item master. <b>Purchase</b> items show in Purchases; <b>Sales</b> items are products you sell (they appear in the sales report).</p>
      <IngredientForm categories={categories} units={units} vendors={vendors} />

      <div className="flex gap-2">
        {tabs.map(([k, l]) => (
          <Link key={k} href={k === "all" ? "/masters/ingredients" : `/masters/ingredients?type=${k}`}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium",
              active === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            {l}
          </Link>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <THead><TR><TH>Item Name</TH><TH>Type</TH><TH>Category</TH><TH>UOM</TH><TH>GST %</TH><TH>Reorder</TH><TH>Default Vendor</TH></TR></THead>
          <TBody>
            {items.map((i: any) => (
              <TR key={i.id}>
                <TD className="font-medium">{i.name}</TD>
                <TD><Badge tone={i.material_type === "sales" ? "green" : i.material_type === "both" ? "amber" : "muted"}>{typeLabel[i.material_type] ?? i.material_type}</Badge></TD>
                <TD>{i.category_name}</TD>
                <TD>{i.uom}</TD>
                <TD>{i.default_gst_rate}%</TD>
                <TD>{i.reorder_level}</TD>
                <TD>{i.vendor_name}</TD>
              </TR>
            ))}
            {items.length === 0 && <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">No items yet.</TD></TR>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
