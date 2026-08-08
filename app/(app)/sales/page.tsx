import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({ title: "Sales", description: "Sales register with POS import, manual entry, edit and delete.", path: "/sales" });
import { getActiveContext } from "@/lib/auth/session";
import { getSalesRegister, getSalesMeta, getSalesImports, type SalesFilters } from "@/server/queries/sales";
import { SalesUpload } from "./sales-upload";
import { SalesFilters as SalesFilterBar } from "./sales-filters";
import { ManualSaleForm } from "./manual-sale-form";
import { SalesTable } from "./sales-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, Upload, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getActiveContext();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const filters: SalesFilters = { search: sp.q, from: sp.from, to: sp.to, payment: sp.payment, category: sp.category };

  const [{ rows, total }, meta, imports] = await Promise.all([
    getSalesRegister(ctx!.orgId!, ctx!.branch?.id ?? null, filters, page, PAGE_SIZE),
    getSalesMeta(ctx!.orgId!, ctx!.branch?.id ?? null),
    getSalesImports(ctx!.orgId!, ctx!.branch?.id ?? null),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (sp.payment) params.set("payment", sp.payment);
    if (sp.category) params.set("category", sp.category);
    params.set("page", String(p));
    return `/sales?${params.toString()}`;
  };
  const anyFilter = !!(sp.q || sp.from || sp.to || sp.payment || sp.category);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Sales</h1>

      <details className="rounded-lg border bg-card">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
          <Upload className="h-4 w-4 text-muted-foreground" aria-hidden /> Upload Petpooja CSV
        </summary>
        <div className="border-t p-4"><SalesUpload branchId={ctx!.branch?.id ?? ""} /></div>
      </details>

      <details className="rounded-lg border bg-card">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
          <PlusCircle className="h-4 w-4 text-muted-foreground" aria-hidden /> Add a sale manually
        </summary>
        <div className="border-t p-4">
          <p className="mb-3 text-xs text-muted-foreground">For one-off sales without a POS export. It feeds the same reports as the CSV.</p>
          <ManualSaleForm categories={meta.categories} />
        </div>
      </details>

      {imports.length > 0 && (
        <details className="rounded-lg border bg-card">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
            CSV import history <span className="ml-auto text-xs text-muted-foreground">{imports.length} recent</span>
          </summary>
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>
                <th className="px-3 py-2 font-medium">When</th><th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 text-right font-medium">Rows imported</th>
              </tr></thead>
              <tbody>
                {imports.map((im: any) => (
                  <tr key={im.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{im.created_at ? new Date(im.created_at).toLocaleString() : "—"}</td>
                    <td className="px-3 py-2">{im.file_path ?? "—"}</td>
                    <td className="px-3 py-2 capitalize">{im.status ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{im.rows_ok ?? 0} / {im.rows_total ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <SalesFilterBar payments={meta.payments} categories={meta.categories} />

      <SalesTable rows={rows} filters={filters} anyFilter={anyFilter} filename="romancham-sales.csv" />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
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
