import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { IngredientForm } from "./ingredient-form";

export default async function IngredientsPage() {
  const ctx = await getActiveContext();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("ingredients")
    .select("id, name, sku, hsn_code, default_gst_rate, reorder_level")
    .eq("org_id", ctx!.orgId!)
    .order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Ingredients</h1>
      <IngredientForm />
      <Card>
        <Table>
          <THead><TR><TH>Name</TH><TH>SKU</TH><TH>HSN</TH><TH>GST %</TH><TH>Reorder level</TH></TR></THead>
          <TBody>
            {(items ?? []).map((i) => (
              <TR key={i.id}>
                <TD className="font-medium">{i.name}</TD>
                <TD>{i.sku ?? "—"}</TD>
                <TD>{i.hsn_code ?? "—"}</TD>
                <TD>{i.default_gst_rate}%</TD>
                <TD>{i.reorder_level}</TD>
              </TR>
            ))}
            {(!items || items.length === 0) && <TR><TD colSpan={5} className="py-8 text-center text-muted-foreground">No ingredients yet.</TD></TR>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
