import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getMaterialFormData, getMaterials } from "@/server/queries/masters";
import { createClient } from "@/lib/supabase/server";
import { IngredientForm } from "./ingredient-form";
import { IngredientsTable } from "./ingredients-table";
import { IngredientsIO } from "./ingredients-io";
import { ArchivedPanel } from "./archived-panel";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({ title: "Ingredients", description: "Maintain your ingredient master with units, costs, reorder levels and fulfilment type.", path: "/masters/ingredients" });

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await getActiveContext();
  const { type } = await searchParams;
  const active = type === "purchase" || type === "sales" ? type : "all";
  const { categories, units, vendors } = await getMaterialFormData(ctx!.orgId!);
  const items = await getMaterials(ctx!.orgId!, active === "all" ? undefined : active);
  const sb = await createClient();
  const { data: archived } = await sb.from("ingredients").select("id, name")
    .eq("org_id", ctx!.orgId!).eq("is_active", false).order("name").limit(50);
  const tabs = [["all", "All"], ["purchase", "Purchase"], ["sales", "Sales"]] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Ingredients</h1>
      <p className="text-sm text-muted-foreground">Your item master. <b>Purchase</b> items show in Purchases; <b>Sales</b> items are products you sell (they appear in the sales report).</p>
      <IngredientForm categories={categories} units={units} vendors={vendors} />

      <div className="flex gap-2">
        {tabs.map(([k, l]) => (
          <Link key={k} href={k === "all" ? "/masters/ingredients" : `/masters/ingredients?type=${k}`}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium", active === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            {l}
          </Link>
        ))}
      </div>

      <IngredientsIO items={items as any} />
      <IngredientsTable items={items as any} categories={categories} units={units} vendors={vendors} />
      <ArchivedPanel items={archived ?? []} />
    </div>
  );
}
