import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { getActiveContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getIngredientCosts } from "@/server/queries/ingredient-costs";
import { getMastersOverview } from "@/server/queries/masters-overview";
import { OverviewTable, type Col } from "./overview-table";
import { CostTable, type PackUnit } from "./cost-table";
import { unitInfo } from "@/lib/costing";
import { cn } from "@/lib/utils";
import { Ruler, Tags, Boxes, Store, IndianRupee, Pencil, Eye } from "lucide-react";
import UnitsPage from "./units/page";
import CategoriesPage from "./categories/page";
import VendorsPage from "./vendors/page";
import { IngredientsView } from "./ingredients/ingredients-view";

// Editing inside Masters is for Owner / Admin only; everyone else views.
const isAdminRole = (r: string | null | undefined) => r === "owner" || r === "admin";

export const metadata: Metadata = pageMetadata({ title: "Masters", description: "Overview of units, categories, ingredients, vendors and ingredient cost per gram / kg.", path: "/masters" });

const UNIT_COLS: Col[] = [{ key: "abbr", label: "Unit", bold: true }, { key: "name", label: "Name" }, { key: "factor", label: "Factor", align: "right" }, { key: "items", label: "Ingredients using it", align: "right" }];
const CAT_COLS: Col[] = [{ key: "name", label: "Category", bold: true }, { key: "type", label: "Type" }, { key: "items", label: "Ingredients", align: "right" }];
const ING_COLS: Col[] = [{ key: "name", label: "Ingredient", bold: true }, { key: "type", label: "Type" }, { key: "category", label: "Category" }, { key: "uom", label: "UOM" }, { key: "pack", label: "Pack size" }, { key: "gst", label: "GST %", align: "right" }, { key: "yieldPct", label: "Usable %", align: "right" }, { key: "vendor", label: "Default vendor" }];
const VEN_COLS: Col[] = [{ key: "name", label: "Vendor", bold: true }, { key: "gstin", label: "GSTIN" }, { key: "state", label: "State" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email" }, { key: "terms", label: "Credit days", align: "right" }, { key: "items", label: "Default for (items)", align: "right" }];

export default async function MastersPage({ searchParams }: { searchParams: Promise<{ tab?: string; mode?: string; type?: string }> }) {
  const ctx = await getActiveContext();
  const orgId = ctx!.orgId!;
  const sp = await searchParams;
  const admin = isAdminRole(ctx?.role);
  const editing = admin && sp.mode === "edit";
  const o = await getMastersOverview(orgId);
  const costCount = o.ingredients.filter((i) => i.type !== "Sales").length;

  const TABS = [
    { key: "units", label: "Units", icon: Ruler, n: o.units.length },
    { key: "categories", label: "Categories", icon: Tags, n: o.categories.length },
    { key: "ingredients", label: "Ingredients", icon: Boxes, n: o.ingredients.length },
    { key: "vendors", label: "Vendors", icon: Store, n: o.vendors.length },
    { key: "costs", label: "Ingredient cost (per g / kg)", icon: IndianRupee, n: costCount },
  ];
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "units";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Masters</h1>
        <p className="text-sm text-muted-foreground">{admin
          ? "Overview of your master data. As Owner/Admin you can switch any tab to Edit."
          : "View-only overview of your master data. Only the Owner/Admin can edit here."}</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map(({ key, label, icon: Icon, n }, i) => (
          <Link key={key} href={`/masters?tab=${key}${editing ? "&mode=edit" : ""}`}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <span className="text-xs opacity-70">{i + 1}.</span><Icon className="h-4 w-4" /> {label}
            <span className={cn("rounded-full px-1.5 text-xs font-semibold", tab === key ? "bg-white/20" : "bg-muted")}>{n}</span>
          </Link>
        ))}
        {admin && tab !== "costs" && (
          <Link href={`/masters?tab=${tab}${editing ? "" : "&mode=edit"}`}
            className={cn("ml-auto flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium", editing ? "border-primary text-primary" : "hover:bg-muted")}>
            {editing ? <><Eye className="h-4 w-4" /> Back to view</> : <><Pencil className="h-4 w-4" /> Edit</>}
          </Link>
        )}
      </div>

      {editing && tab === "units" && <UnitsPage />}
      {editing && tab === "categories" && <CategoriesPage />}
      {editing && tab === "ingredients" && <IngredientsView type={sp.type} showTitle={false} hrefFor={(k) => (k === "all" ? "/masters?tab=ingredients&mode=edit" : `/masters?tab=ingredients&mode=edit&type=${k}`)} />}
      {editing && tab === "vendors" && <VendorsPage />}

      {!editing && tab === "units" && <OverviewTable title="Units" rows={o.units} cols={UNIT_COLS} filename="romancham-units.csv" />}
      {!editing && tab === "categories" && <OverviewTable title="Categories" rows={o.categories} cols={CAT_COLS} groupKey="type" filename="romancham-categories.csv" />}
      {!editing && tab === "ingredients" && <OverviewTable title="Ingredients" rows={o.ingredients} cols={ING_COLS} groupKey="type" filename="romancham-ingredients.csv" />}
      {!editing && tab === "vendors" && <OverviewTable title="Vendors" rows={o.vendors} cols={VEN_COLS} filename="romancham-vendors.csv" />}
      {tab === "costs" && <CostsTab orgId={orgId} canEdit={admin} />}
    </div>
  );
}

async function CostsTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const sb = await createClient();
  const [rows, { data: cats }, { data: units }] = await Promise.all([
    getIngredientCosts(orgId),
    sb.from("categories").select("id, name").eq("org_id", orgId),
    sb.from("units").select("id, abbr").eq("org_id", orgId).order("abbr"),
  ]);
  // Units a pack size can be expressed in: weight and volume only (gms, kg, ml, lts…).
  const packUnits: PackUnit[] = [];
  for (const u of units ?? []) {
    const info = unitInfo({ id: u.id, abbr: u.abbr });
    if (info.family === "mass" || info.family === "volume") packUnits.push({ id: u.id, abbr: u.abbr, family: info.family, factor: info.factor });
  }
  packUnits.sort((a, b) => a.family.localeCompare(b.family) || a.factor - b.factor);
  return <CostTable rows={rows} categories={cats ?? []} packUnits={packUnits} canEdit={canEdit} />;
}
