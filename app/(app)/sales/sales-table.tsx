"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Popover } from "@/components/ui/popover";
import { ExportButton } from "@/components/ui/export-button";
import type { SalesFilters } from "@/server/queries/sales";
import { Columns3 } from "lucide-react";

const ALL_COLS: [string, string][] = [
  ["date_raw", "Date"], ["location", "Location"], ["invoice_no", "Invoice No."], ["payment_type", "Payment Type"],
  ["order_type", "Order Type"], ["area", "Area"], ["item_name", "Item Name"], ["price", "Price"], ["qty", "Qty."],
  ["without_gst", "without GST"], ["discount", "Discount"], ["tax", "Tax"], ["final_total", "Final Total"],
  ["status", "Status"], ["table_no", "Table No."], ["server_name", "Server Name"], ["covers", "Covers"],
  ["variation", "Variation"], ["category", "Category"], ["group_name", "Group Name"], ["hsn", "HSN"],
  ["phone", "Phone"], ["customer_name", "Name"], ["address", "Address"], ["gst", "GST"], ["assign_to", "Assign To"],
  ["non_taxable", "Non Taxable"], ["cgst_rate", "C GST Rate"], ["cgst_amount", "C GST Amount"],
  ["sgst_rate", "S GST Rate"], ["sgst_amount", "S GST Amount"],
];

// Always-visible default columns (9)
const DEFAULT_KEYS = new Set(["date_raw", "location", "invoice_no", "item_name", "category", "payment_type", "qty", "price", "final_total"]);
// Columns the user can toggle on/off (the remaining 22)
const HIDEABLE = ALL_COLS.filter(([k]) => !DEFAULT_KEYS.has(k));
const LS_KEY = "romancham_sales_columns";

export function SalesTable({ rows, filters, anyFilter, filename }: {
  rows: any[]; filters: SalesFilters; anyFilter: boolean; filename: string;
}) {
  // keys of the *extra* (hideable) columns that are switched on
  const [extra, setExtra] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setExtra(arr.filter((k) => HIDEABLE.some(([hk]) => hk === k)));
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) { try { localStorage.setItem(LS_KEY, JSON.stringify(extra)); } catch { /* ignore */ } }
  }, [extra, hydrated]);

  const toggleCol = (k: string) => setExtra((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const shown = ALL_COLS.filter(([k]) => DEFAULT_KEYS.has(k) || extra.includes(k));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Popover align="end" className="w-60"
          trigger={({ toggle, open }) => (
            <button onClick={toggle} aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
              <Columns3 className="h-4 w-4" aria-hidden /> Columns ▾
            </button>
          )}>
          <p className="px-2 pb-1 pt-0.5 text-xs font-medium text-muted-foreground">Show extra columns</p>
          <div className="max-h-72 overflow-auto">
            {HIDEABLE.map(([k, l]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                <input type="checkbox" checked={extra.includes(k)} onChange={() => toggleCol(k)} aria-label={`Show ${l} column`} />
                {l}
              </label>
            ))}
          </div>
        </Popover>
        <ExportButton kind="sales" filters={filters} filename={filename} />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-xs">
          <thead className="border-b bg-muted/50 text-left">
            <tr>{shown.map(([k, l]) => <th key={k} className="px-2 py-2 font-medium">{l}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                {shown.map(([k]) => <td key={k} className="px-2 py-1.5">{r[k] ?? ""}</td>)}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={shown.length} className="px-2 py-8 text-center text-muted-foreground">
                {anyFilter ? "No sales match these filters." : "No sales uploaded yet. Upload your Petpooja CSV or add a sale manually above."}
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
