import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({ title: "Categories", description: "Manage ingredient and expense categories for cleaner reporting.", path: "/masters/categories" });
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { CategoryManager } from "./category-manager";

export default async function CategoriesPage() {
  const ctx = await getActiveContext();
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name")
    .eq("org_id", ctx!.orgId!).eq("type", "ingredient").eq("is_active", true).order("name");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">Groups for your items (Dairy, Bakery, Packaging…). Used in the Ingredients master and Purchases.</p>
      </div>
      <CategoryManager rows={data ?? []} type="ingredient" />
    </div>
  );
}
