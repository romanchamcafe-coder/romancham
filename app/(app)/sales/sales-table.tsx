"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Popover } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExportButton } from "@/components/ui/export-button";
import { toast } from "@/lib/toast";
import { updateSale, deleteSale, type ManualSaleInput } from "@/server/actions/sales";
import type { SalesFilters } from "@/server/queries/sales";
import { Columns3, Pencil, Trash2 } from "lucide-react";

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

const sv = (x: any) => (x == null ? "" : String(x));
const toForm = (r: any): ManualSaleInput => ({
  sale_date: sv(r.sale_date) || sv(r.date_raw),
  item_name: sv(r.item_name),
  category: sv(r.category),
  payment_type: sv(r.payment_type),
  invoice_no: sv(r.invoice_no),
  location: sv(r.location),
  qty: sv(r.qty),
  price: sv(r.price),
  without_gst: sv(r.without_gst),
  tax: sv(r.tax),
  final_total: sv(r.final_total),
});

export function SalesTable({ rows, filters, anyFilter, filename }: {
  rows: any[]; filters: SalesFilters; anyFilter: boolean; filename: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // keys of the *extra* (hideable) columns that are switched on
  const [extra, setExtra] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ManualSaleInput | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmRow = rows.find((r) => r.id === confirmId);
  const set = (k: keyof ManualSaleInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => (s ? { ...s, [k]: e.target.value } : s));

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

  const openEdit = (r: any) => { setForm(toForm(r)); setEditId(r.id); };
  const save = () => {
    if (!editId || !form) return;
    if (!form.item_name.trim()) { toast("Item name is required", "error"); return; }
    start(async () => {
      const res = await updateSale(editId, form);
      if (res?.error) toast(res.error, "error");
      else { toast("Sale updated"); setEditId(null); setForm(null); router.refresh(); }
    });
  };
  const remove = (id: string) => {
    start(async () => {
      const res = await deleteSale(id);
      if (res?.error) toast(res.error, "error");
      else { toast("Sale deleted"); setConfirmId(null); router.refresh(); }
    });
  };

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
            <tr>
              {shown.map(([k, l]) => <th key={k} className="px-2 py-2 font-medium">{l}</th>)}
              <th className="px-2 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                {shown.map(([k]) => <td key={k} className="px-2 py-1.5">{r[k] ?? ""}</td>)}
                <td className="px-2 py-1.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label={`Edit sale ${r.item_name ?? ""}`}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(r.id)} aria-label={`Delete sale ${r.item_name ?? ""}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={shown.length + 1} className="px-2 py-8 text-center text-muted-foreground">
                {anyFilter ? "No sales match these filters." : "No sales uploaded yet. Upload your Petpooja CSV or add a sale manually above."}
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog
        open={!!editId && !!form}
        onClose={() => { setEditId(null); setForm(null); }}
        title="Edit sale"
        description="Editing a row re-syncs stock for its date automatically."
        footer={
          <>
            <Button variant="outline" onClick={() => { setEditId(null); setForm(null); }} disabled={pending}>Cancel</Button>
            <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
          </>
        }
      >
        {form && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="es-date">Date</Label><Input id="es-date" type="date" value={form.sale_date} onChange={set("sale_date")} /></div>
            <div className="space-y-1.5"><Label htmlFor="es-item">Item name</Label><Input id="es-item" value={form.item_name} onChange={set("item_name")} /></div>
            <div className="space-y-1.5"><Label htmlFor="es-cat">Category</Label><Input id="es-cat" value={form.category} onChange={set("category")} placeholder="optional" /></div>
            <div className="space-y-1.5"><Label htmlFor="es-pay">Payment type</Label><Input id="es-pay" value={form.payment_type} onChange={set("payment_type")} placeholder="optional" /></div>
            <div className="space-y-1.5"><Label htmlFor="es-inv">Invoice no.</Label><Input id="es-inv" value={form.invoice_no} onChange={set("invoice_no")} placeholder="optional" /></div>
            <div className="space-y-1.5"><Label htmlFor="es-qty">Qty</Label><Input id="es-qty" type="number" step="0.0001" value={form.qty} onChange={set("qty")} /></div>
            <div className="space-y-1.5"><Label htmlFor="es-price">Price</Label><Input id="es-price" type="number" step="0.01" value={form.price} onChange={set("price")} /></div>
            <div className="space-y-1.5"><Label htmlFor="es-total">Final total</Label><Input id="es-total" type="number" step="0.01" value={form.final_total} onChange={set("final_total")} /></div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!confirmId}
        title="Delete this sale?"
        description={confirmRow ? `${confirmRow.item_name ?? "This row"}${confirmRow.sale_date ? " on " + confirmRow.sale_date : ""} will be permanently removed and stock re-synced for that date.` : "This row will be permanently removed."}
        confirmLabel="Delete"
        destructive
        busy={pending}
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
