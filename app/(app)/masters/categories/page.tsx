import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { CategoryForm } from "./category-form";

export default async function CategoriesPage() {
  const ctx = await getActiveContext();
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name")
    .eq("org_id", ctx!.orgId!).eq("type", "ingredient").order("name");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Categories</h1>
      <p className="text-sm text-muted-foreground">Groups for your items (Dairy, Bakery, Packaging…). Used in the Item master and Purchases.</p>
      <CategoryForm />
      <Card>
        <Table>
          <THead><TR><TH>Category</TH></TR></THead>
          <TBody>
            {(data ?? []).map((c) => <TR key={c.id}><TD className="font-medium">{c.name}</TD></TR>)}
            {(!data || data.length === 0) && <TR><TD className="py-8 text-center text-muted-foreground">No categories yet.</TD></TR>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
