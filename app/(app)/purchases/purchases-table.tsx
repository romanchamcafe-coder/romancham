"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { deletePurchase } from "@/server/actions/purchases";
import { inr } from "@/lib/utils";
import { ChevronUp, ChevronDown, Columns3, MoveHorizontal, Pencil, Trash2 } from "lucide-react";
import type { PurchaseRow } from "@/server/queries/purchases";

type Col = { key: keyof PurchaseRow; label: string; numeric?: boolean };
const COLS: Col[] = [
  { key: "payment_mode", label: "Petty cash/Credit" },
  { key: "vendor", label: "Vendor" },
  { key: "location", label: "Location" },
  { key: "bill_no", label: "Invoice No" },
  { key: "bill_date", label: "Bill Date" },
  { key: "category", label: "Category" },
  { key: "product", label: "Product" },
  { key: "uom", label: "UOM" },
  { key: "qty", label: "Qty", numeric: true },
  { key: "rate", label: "Per pcs", numeric: true },
  { key: "without_gst", label: "Without GST", numeric: true },
  { key: "with_gst", label: "With GST", numeric: true },
];
const modeLabel = (m: string | null) => (m === "petty_cash" ? "Petty Cash" : m === "credit" ? "Credit" : "—");

export function PurchasesTable({ rows, sort, dir }: { rows: PurchaseRow[]; sort?: string; dir?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showCols, setShowCols] = useState(false);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<{ id: string; label: string } | null>(null);

  const visible = COLS.filter((c) => !hidden.has(c.key));

  const del = (purchaseId: string) => {
    start(async () => {
      const res = await deletePurchase(purchaseId);
      if (res?.error) toast(res.error, "error");
      else { toast("Purchase deleted"); setConfirm(null); router.refresh(); }
    });
  };

  const sortBy = (key: string) => {
    const params = new URLSearchParams(sp.toString());
    const nextDir = sort === key && dir === "asc" ? "desc" : "asc";
    params.set("sort", key); params.set("dir", nextDir); params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };
  const toggleCol = (k: string) => setHidden((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const cell = (c: Col, r: PurchaseRow) => {
    if (c.key === "payment_mode") return <Badge tone={r.payment_mode === "petty_cash" ? "green" : "amber"}>{modeLabel(r.payment_mode)}</Badge>;
    if (c.numeric) return c.key === "qty" ? r.qty : inr(r[c.key] as number);
    return r[c.key] as string;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MoveHorizontal className="h-3.5 w-3.5" aria-hidden /> Scroll sideways to see all columns · click a header to sort
        </p>
        <div className="relative">
          <button onClick={() => setShowCols((v) => !v)} aria-expanded={showCols}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
            <Columns3 className="h-4 w-4" aria-hidden /> Columns
          </button>
          {showCols && (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border bg-card p-2 shadow-lg">
              {COLS.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => toggleCol(c.key)} aria-label={`Show ${c.label} column`} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <Card className="max-h-[70vh] overflow-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-left shadow-sm">
            <tr>
              {visible.map((c) => (
                <th key={c.key} onClick={() => sortBy(c.key)}
                  aria-sort={sort === c.key ? (dir === "asc" ? "ascending" : "descending") : "none"}
                  className={"cursor-pointer select-none px-3 py-2 font-medium hover:bg-muted/70 " + (c.numeric ? "text-right" : "")}>
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort === c.key && (dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                {visible.map((c) => (
                  <td key={c.key} className={"px-3 py-2 " + (c.numeric ? "text-right tabular-nums" : "") + (c.key === "product" ? " font-medium" : "")}>
                    {cell(c, r)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Link href={`/purchases/${r.purchase_id}/edit`} aria-label={`Edit bill ${r.bill_no}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button onClick={() => setConfirm({ id: r.purchase_id, label: `${r.product} · ${r.bill_no}` })}
                      aria-label={`Delete bill ${r.bill_no}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={visible.length + 1} className="px-3 py-8 text-center text-muted-foreground">No purchases match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <ConfirmDialog
        open={!!confirm}
        title="Delete this purchase bill?"
        description="This removes the whole bill (all its line items) and reverses the stock it added. If any of that stock has already been used, the delete will be blocked. This cannot be undone."
        confirmLabel="Delete bill"
        destructive
        busy={pending}
        onConfirm={() => confirm && del(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
