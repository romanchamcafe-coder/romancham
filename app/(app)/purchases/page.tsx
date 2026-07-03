import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getPurchaseRegister, getPurchaseReadiness, getPurchaseMeta, type PurchaseFilters } from "@/server/queries/purchases";
import { Button } from "@/components/ui/button";
import { OnboardingChecklist } from "@/components/ui/onboarding-checklist";
import { PurchasesTable } from "./purchases-table";
import { PurchasesFilters } from "./purchases-filters";
import { NewPurchaseButton } from "./new-purchase-button";
import { ExportButton } from "@/components/ui/export-button";
import type { PurchaseSortKey } from "@/server/queries/purchases";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getActiveContext();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const anyFilter = !!(sp.q || sp.vendor || sp.invoice || sp.from || sp.to || sp.category);
  const filters: PurchaseFilters = {
    search: sp.q, vendor: sp.vendor, invoice: sp.invoice, from: sp.from, to: sp.to, category: sp.category,
    sort: sp.sort as PurchaseSortKey | undefined, dir: sp.dir === "desc" ? "desc" : sp.dir === "asc" ? "asc" : undefined,
  };

  const { rows, total } = await getPurchaseRegister(ctx!.orgId!, ctx!.branch?.id ?? null, filters, page, PAGE_SIZE);

  // Empty state (no purchases at all, no filters) → onboarding
  if (total === 0 && !anyFilter) {
    const ready = await getPurchaseReadiness(ctx!.orgId!);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Purchases</h1>
          <NewPurchaseButton disabled={ready.ingredients === 0 || ready.vendors === 0} />
        </div>
        <OnboardingChecklist
          title="Let's record your first purchase"
          description="Purchases feed your inventory, FIFO costing and GST. Complete these steps to get started."
          steps={[
            { title: "Add the items you buy", description: "Create your purchase items (raw materials, packaging) under Ingredients.", href: "/masters/ingredients?type=purchase", cta: "Add items", done: ready.ingredients > 0 },
            { title: "Add a vendor", description: "Add at least one supplier so GST can auto-split and pricing can pre-fill.", href: "/masters/vendors", cta: "Add vendor", done: ready.vendors > 0 },
            { title: "Record a purchase bill", description: "Enter a bill with its line items — stock and costs update automatically.", href: "/purchases/new", cta: "New purchase", done: false },
          ]}
        />
      </div>
    );
  }

  const meta = await getPurchaseMeta(ctx!.orgId!);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.vendor) params.set("vendor", sp.vendor);
    if (sp.invoice) params.set("invoice", sp.invoice);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (sp.category) params.set("category", sp.category);
    params.set("page", String(p));
    return `/purchases?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchases</h1>
        <NewPurchaseButton disabled={false} />
      </div>

      <PurchasesFilters vendors={meta.vendors} categories={meta.categories} />

      <div className="flex justify-end">
        <ExportButton kind="purchases" filters={filters} filename="romancham-purchases.csv" />
      </div>

      <PurchasesTable rows={rows} sort={sp.sort} dir={sp.dir} />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}</span>
          <div className="flex items-center gap-2">
            {page > 1
              ? <Link href={qs(page - 1)}><Button size="sm" variant="outline"><ChevronLeft className="h-4 w-4" /> Prev</Button></Link>
              : <Button size="sm" variant="outline" disabled><ChevronLeft className="h-4 w-4" /> Prev</Button>}
            <span className="tabular-nums">Page {page} / {totalPages}</span>
            {page < totalPages
              ? <Link href={qs(page + 1)}><Button size="sm" variant="outline">Next <ChevronRight className="h-4 w-4" /></Button></Link>
              : <Button size="sm" variant="outline" disabled>Next <ChevronRight className="h-4 w-4" /></Button>}
          </div>
        </div>
      )}
    </div>
  );
}
