import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { getActiveContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getIngredientCosts } from "@/server/queries/ingredient-costs";
import UnitsPage from "./units/page";
import CategoriesPage from "./categories/page";
import VendorsPage from "./vendors/page";
import { IngredientsView } from "./ingredients/ingredients-view";
import { CostTable } from "./cost-table";
import { cn } from "@/lib/utils";
import { Ruler, Tags, Boxes, Store, IndianRupee } from "lucide-react";

export const metadata: Metadata = pageMetadata({ title: "Masters", description: "Units, categories, ingredients, vendors and ingredient cost per gram / kg in one place.", path: "/masters" });

const TABS = [
  { key: "units", label: "Units", icon: Ruler },
  { key: "categories", label: "Categories", icon: Tags },
  { key: "ingredients", label: "Ingredients", icon: Boxes },
  { key: "vendors", label: "Vendors", icon: Store },
  { key: "costs", label: "Ingredient cost (per g / kg)", icon: IndianRupee },
] as const;

export default async function MastersPage({ searchParams }: { searchParams: Promise<{ tab?: string; type?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "units";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Masters</h1>
        <p className="text-sm text-muted-foreground">All your master data in one place.</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map(({ key, label, icon: Icon }, i) => (
          <Link key={key} href={`/masters?tab=${key}`}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <span className="text-xs opacity-70">{i + 1}.</span><Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </div>

      {tab === "units" && <UnitsPage />}
      {tab === "categories" && <CategoriesPage />}
      {tab === "ingredients" && <IngredientsView type={sp.type} hrefFor={(k) => (k === "all" ? "/masters?tab=ingredients" : `/masters?tab=ingredients&type=${k}`)} />}
      {tab === "vendors" && <VendorsPage />}
      {tab === "costs" && <CostsTab />}
    </div>
  );
}

async function CostsTab() {
  const ctx = await getActiveContext();
  const sb = await createClient();
  const [rows, { data: cats }] = await Promise.all([
    getIngredientCosts(ctx!.orgId!),
    sb.from("categories").select("id, name").eq("org_id", ctx!.orgId!),
  ]);
  return <CostTable rows={rows} categories={cats ?? []} />;
}
