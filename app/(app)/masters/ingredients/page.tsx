import { getActiveContext } from "@/lib/auth/session";
import { getMaterialFormData, getMaterials } from "@/server/queries/masters";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { IngredientForm } from "./ingredient-form";

export default async function MaterialsPage() {
  const ctx = await getActiveContext();
  const { categories, units, vendors } = await getMaterialFormData(ctx!.orgId!);
  const items = await getMaterials(ctx!.orgId!);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Materials</h1>
      <p className="text-sm text-muted-foreground">Your material master. Category, UOM, GST &amp; default vendor here auto-fill into Purchases.</p>
      <IngredientForm categories={categories} units={units} vendors={vendors} />
      <Card className="overflow-x-auto">
        <Table>
          <THead><TR><TH>Material</TH><TH>Category</TH><TH>UOM</TH><TH>GST %</TH><TH>Reorder</TH><TH>Default Vendor</TH></TR></THead>
          <TBody>
            {items.map((i: any) => (
              <TR key={i.id}>
                <TD className="font-medium">{i.name}</TD>
                <TD>{i.category_name}</TD>
                <TD>{i.uom}</TD>
                <TD>{i.default_gst_rate}%</TD>
                <TD>{i.reorder_level}</TD>
                <TD>{i.vendor_name}</TD>
              </TR>
            ))}
            {items.length === 0 && <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">No materials yet.</TD></TR>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
