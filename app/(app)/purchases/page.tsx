import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getPurchaseRegister, getPurchaseBills, getPurchaseReadiness, getPurchaseMeta, getOutstandingPayables, type PurchaseFilters } from "@/server/queries/purchases";
import { inr } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OnboardingChecklist } from "@/components/ui/onboarding-checklist";
import { PurchasesTable } from "./purchases-table";
import { PurchaseBillsTable } from "./purchases-bills-table";
import { PurchasesFilters } from "./purchases-filters";
import { NewPurchaseButton } from "./new-purchase-button";
import { ExportButton } from "@/components/ui/export-button";
import type { PurchaseSortKey } from "@/server/queries/purchases";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const metadata: Metadata = pageMetadata({ title: "Purchases", description: "Purchase register with vendor, date and value filters.", path: "/purchases" });

const PAGE_SIZE = 50;

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getActiveContext();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const view = sp.view === "bills" ? "bills" : "items";
  const payment = sp.payment === "paid" ? "paid" : sp.payment === "unpaid" ? "unpaid" : undefined;
  const anyFilter = !!(sp.q || sp.vendor || sp.invoice || sp.from || sp.to || sp.category || payment);
  const filters: PurchaseFilters = {
    search: sp.q, vendor: sp.vendor, invoice: sp.invoice, from: sp.from, to: sp.to, category: sp.category, payment,
    sort: sp.sort as PurchaseSortKey | undefined, dir: sp.dir === "desc" ? "desc" : sp.dir === "asc" ? "asc" : undefined,
  };

  const itemsData = view === "items" ? await getPurchaseRegister(ctx!.orgId!, ctx!.branch?.id ?? null, filters, page, PAGE_SIZE) : null;
  const billsData = view === "bills" ? await getPurchaseBills(ctx!.orgId!, ctx!.branch?.id ?? null, filters, page, PAGE_SIZE) : null;
  const rows = itemsData?.rows ?? [];
  const billRows = billsData?.rows ?? [];
  const total = view === "bills" ? billsData!.total : itemsData!.total;

  if (total === 0 && !anyFilter) {
    const ready = await getPurchaseReadiness(ctx!.orgId!);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Purchases</h1>
          <NewPurchaseButton disabled={ready.ingredients === 0 || ready.vendors === 0} />
        </div>
        <OnboardingChecklist
          dismissKey="romancham_purchases_checklist_dismissed"
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
  const outstanding = await getOutstandingPayables(ctx!.orgId!, ctx!.branch?.id ?? null);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseParams = () => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.vendor) params.set("vendor", sp.vendor);
    if (sp.invoice) params.set("invoice", sp.invoice);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (sp.category) params.set("category", sp.category);
    if (payment) params.set("payment", payment);
    if (view === "bills") params.set("view", "bills");
    return params;
  };
  const viewHref = (v: "items" | "bills") => {
    const params = baseParams();
    params.delete("view"); params.delete("sort"); params.delete("dir");
    if (v === "bills") params.set("view", "bills");
    params.set("page", "1");
    const s = params.toString();
    return s ? `/purchases?${s}` : "/purchases";
  };
  const viewTab = (label: string, v: "items" | "bills") => (
    <Link href={viewHref(v)}
      className={"rounded-md border px-3 py-1.5 text-xs font-medium " + (view === v ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
      {label}
    </Link>
  );
  const qs = (p: number) => {
    const params = baseParams();
    params.set("page", String(p));
    return `/purchases?${params.toString()}`;
  };
  const payHref = (val?: "paid" | "unpaid") => {
    const params = baseParams();
    params.delete("payment");
    if (val) params.set("payment", val);
    params.set("page", "1");
    const s = params.toString();
    return s ? `/purchases?${s}` : "/purchases";
  };
  const payTab = (label: string, val?: "paid" | "unpaid") => {
    const active = payment === val || (!payment && !val);
    return (
      <Link href={payHref(val)}
        className={"rounded-full border px-3 py-1 text-xs font-medium " + (active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchases</h1>
        <NewPurchaseButton disabled={false} />
      </div>

      <PurchasesFilters vendors={meta.vendors} categories={meta.categories} />

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">View:</span>
        {viewTab("Bill summary", "bills")}
        {viewTab("Line items", "items")}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {payTab("All")}
          {payTab("Unpaid", "unpaid")}
          {payTab("Paid", "paid")}
        </div>
        <div className="flex items-center gap-3">
          <span className={"rounded-md px-3 py-1 text-sm font-medium " + (outstanding > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700")}>
            Outstanding payables: {inr(outstanding)}
          </span>
          <ExportButton kind="purchases" filters={filters} filename="romancham-purchases.csv" />
        </div>
      </div>

      {view === "bills"
        ? <PurchaseBillsTable rows={billRows} sort={sp.sort} dir={sp.dir} />
        : <PurchasesTable rows={rows} sort={sp.sort} dir={sp.dir} />}

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
