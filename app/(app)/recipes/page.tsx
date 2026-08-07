import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({ title: "Recipes", description: "Build recipes and see live food cost per item from ingredient prices.", path: "/recipes" });
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getRecipeData } from "@/server/queries/recipes";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RecipeBuilder } from "./recipe-builder";
import { OnboardingChecklist } from "@/components/ui/onboarding-checklist";
import { inr } from "@/lib/utils";

export default async function RecipesPage() {
  const ctx = await getActiveContext();
  const { salesItems, purchaseItems, costMap, recipeList } = await getRecipeData(ctx!.orgId!);

  if (salesItems.length === 0 || purchaseItems.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Recipes</h1>
        <p className="text-sm text-muted-foreground">Recipes link each menu (Sales) item to what it&apos;s made of, so Romancham can calculate your Food Cost %.</p>
        <OnboardingChecklist
          dismissKey="romancham_recipes_checklist_dismissed"
          title="Set up recipes in 3 steps"
          description="You need your menu items and their ingredients in place before building recipes."
          steps={[
            { title: "Add your menu (Sales) items", description: "Create the dishes/drinks you sell as Sales items in Ingredients.", href: "/masters/ingredients?type=sales", cta: "Add sales items", done: salesItems.length > 0 },
            { title: "Add your Purchase items", description: "Add the raw materials each recipe consumes (flour, milk, sugar…).", href: "/masters/ingredients?type=purchase", cta: "Add purchase items", done: purchaseItems.length > 0 },
            { title: "Build your first recipe", description: "Map each sales item to its ingredients and quantities. Recipe cost feeds Food Cost %.", href: "/recipes", cta: "Build recipe", done: false },
          ]}
        />
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
