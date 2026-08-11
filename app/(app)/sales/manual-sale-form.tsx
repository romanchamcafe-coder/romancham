"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualSaleBill } from "@/server/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { inr } from "@/lib/utils";
import { Trash2 } from "lucide-react";

type Line = { item_name: string; category: string; qty: string; price: string; final_total: string; autoTotal: boolean };
const blankLine = (): Line => ({ item_name: "", category: "", qty: "1", price: "", final_total: "", autoTotal: true });
const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const num = (v: string) => Number(v) || 0;

export function ManualSaleForm({ categories = [] }: { categories?: string[] }) {
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

      <datalist id="sale-categories">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-2 py-2 font-medium">Item name</th>
              <th className="px-2 py-2 font-medium">Category</th>
              <th className="px-2 py-2 font-medium">Qty</th>
              <th className="px-2 py-2 font-medium">Price</th>
              <th className="px-2 py-2 font-medium">Final total (₹)</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const qtyBad = submitted && l.item_name.trim() !== "" && (l.qty === "" || num(l.qty) < 1);
              return (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-1.5"><Input className="h-9 min-w-40" value={l.item_name} onChange={(e) => updateLine(i, { item_name: e.target.value })} placeholder="e.g. Cappuccino" aria-label="Item name" /></td>
                  <td className="p-1.5"><Input className="h-9 w-32" value={l.category} onChange={(e) => updateLine(i, { category: e.target.value })} placeholder="e.g. Beverages" list="sale-categories" autoComplete="off" aria-label="Category" /></td>
                  <td className="p-1.5"><Input className="h-9 w-20" type="number" min="1" value={l.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} aria-invalid={qtyBad} aria-label="Quantity" /></td>
                  <td className="p-1.5"><Input className="h-9 w-24" type="number" step="0.01" min="0" value={l.price} onChange={(e) => updateLine(i, { price: e.target.value })} placeholder="0" aria-label="Price" /></td>
                  <td className="p-1.5"><Input className="h-9 w-28" type="number" step="0.01" value={l.final_total} onChange={(e) => onFinalTotal(i, e.target.value)} placeholder="0" aria-label="Final total" /></td>
                  <td className="p-1.5 text-center">
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive" aria-label="Remove item">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="p-2">
          <Button variant="outline" size="sm" type="button" onClick={() => setLines((ls) => [...ls, blankLine()])}>+ Add item</Button>
        </div>
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
