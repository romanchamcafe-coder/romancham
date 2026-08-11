"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualSaleBill } from "@/server/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectOrType } from "@/components/ui/select-or-type";
import { toast } from "@/lib/toast";
import { inr } from "@/lib/utils";
import { Trash2 } from "lucide-react";

type Line = { item_name: string; category: string; qty: string; price: string; final_total: string; autoTotal: boolean };
const blankLine = (): Line => ({ item_name: "", category: "", qty: "1", price: "", final_total: "", autoTotal: true });
const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const num = (v: string) => Number(v) || 0;

export function ManualSaleForm({ categories = [], products = [] }: { categories?: string[]; products?: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNo, setInvoiceNo] = useState("");
  const [payment, setPayment] = useState("Cash");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [submitted, setSubmitted] = useState(false);

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => {
      if (idx !== i) return l;
      const merged = { ...l, ...patch };
      // Keep Final total = Price × Qty until the user edits it manually.
      if (merged.autoTotal && ("qty" in patch || "price" in patch)) {
        merged.final_total = String(Number((num(merged.price) * num(merged.qty)).toFixed(2)));
      }
      return merged;
    }));

  const onFinalTotal = (i: number, val: string) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, final_total: val, autoTotal: false } : l)));

  const lineTotal = (l: Line) => (l.final_total !== "" ? num(l.final_total) : num(l.price) * num(l.qty));
  const grand = lines.reduce((s, l) => s + lineTotal(l), 0);

  const submit = () => {
    setSubmitted(true);
    const filled = lines.filter((l) => l.item_name.trim());
    if (filled.length === 0) { toast("Add at least one item", "error"); return; }
    for (const l of filled) {
      if (l.qty === "" || isNaN(num(l.qty)) || num(l.qty) < 1) { toast(`Quantity must be at least 1 for "${l.item_name}"`, "error"); return; }
      if (l.price !== "" && (isNaN(Number(l.price)) || Number(l.price) < 0)) { toast(`Price cannot be negative for "${l.item_name}"`, "error"); return; }
    }
    start(async () => {
      const res = await createManualSaleBill({
        sale_date: saleDate,
        invoice_no: invoiceNo,
        payment_type: payment,
        lines: filled.map((l) => ({ item_name: l.item_name, category: l.category, qty: l.qty, price: l.price, final_total: l.final_total })),
      });
      if (res.error) toast(res.error, "error");
      else {
        toast(res.added && res.added > 1 ? `${res.added} items added` : "Sale added");
        setLines([blankLine()]); setInvoiceNo(""); setSubmitted(false); router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="ms-date">Date</Label><Input id="ms-date" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="ms-inv">Invoice no.</Label><Input id="ms-inv" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="optional — shared by all items below" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="ms-pay">Payment</Label>
          <select id="ms-pay" className={sel} value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option>Cash</option><option>UPI</option><option>Card</option><option>Other</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {lines.map((l, i) => {
          const qtyBad = submitted && l.item_name.trim() !== "" && (l.qty === "" || num(l.qty) < 1);
          return (
            <div key={i} className="rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-12 sm:items-end">
                <div className="col-span-2 space-y-1 sm:col-span-4">
                  <Label className="text-xs">Item name</Label>
                  <SelectOrType value={l.item_name} onChange={(v) => updateLine(i, { item_name: v })} options={products} placeholder="Select item…" ariaLabel="Item name" />
                </div>
                <div className="col-span-2 space-y-1 sm:col-span-3">
                  <Label className="text-xs">Category</Label>
                  <SelectOrType value={l.category} onChange={(v) => updateLine(i, { category: v })} options={categories} placeholder="Select category…" ariaLabel="Category" />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-xs">Qty</Label>
                  <Input className="h-9 w-full" type="number" min="1" value={l.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} aria-invalid={qtyBad} aria-label="Quantity" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Price</Label>
                  <Input className="h-9 w-full" type="number" step="0.01" min="0" value={l.price} onChange={(e) => updateLine(i, { price: e.target.value })} placeholder="0" aria-label="Price" />
                </div>
                <div className="col-span-2 space-y-1 sm:col-span-2">
                  <Label className="text-xs">Final total (₹)</Label>
                  <Input className="h-9 w-full" type="number" step="0.01" value={l.final_total} onChange={(e) => onFinalTotal(i, e.target.value)} placeholder="0" aria-label="Final total" />
                </div>
              </div>
              {lines.length > 1 && (
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive" aria-label="Remove item">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <Button variant="outline" size="sm" type="button" onClick={() => setLines((ls) => [...ls, blankLine()])}>+ Add item</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Bill total <span className="font-semibold text-foreground">{inr(grand)}</span>
          <div className="text-xs">Final total auto-fills from Price × Qty per line. Edit a line total to apply discounts.</div>
        </div>
        <Button onClick={submit} disabled={pending}>{pending ? "Adding…" : "Add sale"}</Button>
      </div>
    </div>
  );
}
