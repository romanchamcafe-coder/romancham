import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({ title: "Recipes", description: "Prep / component recipes and final dishes with live food cost from ingredient prices.", path: "/recipes" });
import { getActiveContext } from "@/lib/auth/session";
import { getRecipeData, getRecipeWorkspace } from "@/server/queries/recipes";
import { RecipeWorkspace } from "./recipe-workspace";
import { RecipesIO } from "./recipes-io";
import { OnboardingChecklist } from "@/components/ui/onboarding-checklist";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await getActiveContext();
  const sp = await searchParams;
  const [{ data, prices, categories }, legacy] = await Promise.all([getRecipeWorkspace(ctx!.orgId!), getRecipeData(ctx!.orgId!)]);

  const hasRaw = data.items.some((i) => i.isActive && (i.materialType === "purchase" || i.materialType === "both"));
  const hasSales = data.items.some((i) => i.isActive && (i.materialType === "sales" || i.materialType === "both"));
  if (!hasRaw) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Recipes</h1>
        <OnboardingChecklist
          dismissKey="romancham_recipes_checklist_dismissed"
          title="Set up recipes in 3 steps"
          description="You need your raw ingredients in place before building recipes."
          steps={[
            { title: "Add your Purchase items", description: "Raw materials you buy (yoghurt, oats, honey…).", href: "/masters/ingredients?type=purchase", cta: "Add purchase items", done: hasRaw },
            { title: "Add your menu (Sales) items", description: "The dishes/drinks you sell.", href: "/masters/ingredients?type=sales", cta: "Add sales items", done: hasSales },
            { title: "Build preps and dishes", description: "Preps (batches) and final dishes, costed automatically.", href: "/recipes", cta: "Build recipe", done: false },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Recipes <span className="text-sm font-normal text-muted-foreground">Raw → Prep → Dish → Food cost</span></h1>
      <RecipeWorkspace data={data} prices={prices} categories={categories} initialTab={sp.tab === "prep" ? "prep" : "dish"} />
      <RecipesIO recipes={legacy.recipeList} />
    </div>
  );
}
