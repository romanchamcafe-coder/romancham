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
import { Ruler, Tags, Boxes, Store, IndianRupee } from "lucide-react";

export const metadata: Metadata = pageMetadata({ title: "Masters", description: "Overview of units, categories, ingredients, vendors and ingredient cost per gram / kg.", path: "/masters" });

const UNIT_COLS: Col[] = [{ key: "abbr", label: "Unit", bold: true }, { key: "name", label: "Name" }, { key: "factor", label: "Factor", align: "right" }, { key: "items", label: "Ingredients using it", align: "right" }];
const CAT_COLS: Col[] = [{ key: "name", label: "Category", bold: true }, { key: "type", label: "Type" }, { key: "items", label: "Ingredients", align: "right" }];
const ING_COLS: Col[] = [{ key: "name", label: "Ingredient", bold: true }, { key: "type", label: "Type" }, { key: "category", label: "Category" }, { key: "uom", label: "UOM" }, { key: "pack", label: "Pack size" }, { key: "gst", label: "GST %", align: "right" }, { key: "yieldPct", label: "Usable %", align: "right" }, { key: "vendor", label: "Default vendor" }];
const VEN_COLS: Col[] = [{ key: "name", label: "Vendor", bold: true }, { key: "gstin", label: "GSTIN" }, { key: "state", label: "State" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email" }, { key: "terms", label: "Credit days", align: "right" }, { key: "items", label: "Default for (items)", align: "right" }];

export default async function MastersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await getActiveContext();
  const orgId = ctx!.orgId!;
  const sp = await searchParams;
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
        <p className="text-sm text-muted-foreground">Overview of your master data (tabs 1–4 are view-only — edit them from the menu). Tab 5 lets you edit pack size and usable % to get per-g / per-kg cost.</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map(({ key, label, icon: Icon, n }, i) => (
          <Link key={key} href={`/masters?tab=${key}`}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <span className="text-xs opacity-70">{i + 1}.</span><Icon className="h-4 w-4" /> {label}
            <span className={cn("rounded-full px-1.5 text-xs font-semibold", tab === key ? "bg-white/20" : "bg-muted")}>{n}</span>
          </Link>
        ))}
      </div>

      {tab === "units" && <OverviewTable title="Units" rows={o.units} cols={UNIT_COLS} filename="romancham-units.csv" />}
      {tab === "categories" && <OverviewTable title="Categories" rows={o.categories} cols={CAT_COLS} groupKey="type" filename="romancham-categories.csv" />}
      {tab === "ingredients" && <OverviewTable title="Ingredients" rows={o.ingredients} cols={ING_COLS} groupKey="type" filename="romancham-ingredients.csv" />}
      {tab === "vendors" && <OverviewTable title="Vendors" rows={o.vendors} cols={VEN_COLS} filename="romancham-vendors.csv" />}
      {tab === "costs" && <CostsTab orgId={orgId} />}
    </div>
  );
}

async function CostsTab({ orgId }: { orgId: string }) {
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
  return <CostTable rows={rows} categories={cats ?? []} packUnits={packUnits} />;
}
