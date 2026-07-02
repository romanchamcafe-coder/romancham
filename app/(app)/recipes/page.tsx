import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getRecipeData } from "@/server/queries/recipes";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RecipeBuilder } from "./recipe-builder";
import { inr } from "@/lib/utils";

export default async function RecipesPage() {
  const ctx = await getActiveContext();
  const { salesItems, purchaseItems, costMap, recipeList } = await getRecipeData(ctx!.orgId!);

  if (salesItems.length === 0 || purchaseItems.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Recipes</h1>
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          To build recipes you need at least one <Link href="/masters/ingredients?type=sales" className="text-primary underline">Sales item</Link> and some <Link href="/masters/ingredients?type=purchase" className="text-primary underline">Purchase items</Link> in Ingredients. Add them, then come back.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Recipes <span className="text-sm font-normal text-muted-foreground">→ Food Cost</span></h1>
      <p className="text-sm text-muted-foreground">Define what each Sales item is made of. The recipe cost feeds <b>Food Cost %</b> on the dashboard (matched to your uploaded sales by item name).</p>
      <RecipeBuilder salesItems={salesItems} purchaseItems={purchaseItems} costMap={costMap} recipes={recipeList.map((r) => ({ id: r.id, components: r.components.map((c) => ({ component_id: c.component_id, qty: c.qty })) }))} />

      <Card className="overflow-x-auto">
        <Table>
          <THead><TR><TH>Sales Item</TH><TH>Components</TH><TH className="text-right">Recipe Cost</TH></TR></THead>
          <TBody>
            {recipeList.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.name}</TD>
                <TD className="text-muted-foreground">{r.components.length ? r.components.map((c) => `${c.name} ×${c.qty}`).join(", ") : "— not set —"}</TD>
                <TD className="text-right font-medium tabular-nums">{r.components.length ? inr(r.cost) : "—"}</TD>
              </TR>
            ))}
            {recipeList.length === 0 && <TR><TD colSpan={3} className="py-8 text-center text-muted-foreground">No sales items yet.</TD></TR>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
