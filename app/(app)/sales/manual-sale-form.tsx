"use client";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualSale, type ManualSaleInput } from "@/server/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";

const empty: ManualSaleInput = {
  sale_date: new Date().toISOString().slice(0, 10), item_name: "", category: "", payment_type: "Cash",
  invoice_no: "", location: "", qty: "1", price: "", without_gst: "", tax: "", final_total: "",
};
const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function ManualSaleForm({ categories = [] }: { categories?: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<ManualSaleInput>(empty);
  const [autoTotal, setAutoTotal] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const set = (k: keyof ManualSaleInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  // Auto-calculate Final total = Price × Qty (until the user edits it manually)
  useEffect(() => {
    if (!autoTotal) return;
    if (v.price === "" || v.qty === "") return;
    const t = (Number(v.price) || 0) * (Number(v.qty) || 0);
    const next = String(Number(t.toFixed(2)));
    setV((s) => (s.final_total === next ? s : { ...s, final_total: next }));
  }, [v.price, v.qty, autoTotal]);

  const onFinalTotal = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoTotal(false);
    setV((s) => ({ ...s, final_total: e.target.value }));
  };

  const qtyBad = v.qty === "" || isNaN(Number(v.qty)) || Number(v.qty) < 1;
  const priceBad = v.price !== "" && (isNaN(Number(v.price)) || Number(v.price) < 0);

  const submit = () => {
    setSubmitted(true);
    if (!v.item_name.trim()) { toast("Item name is required", "error"); return; }
    if (qtyBad) return;
    if (priceBad) return;
    if (!v.final_total?.trim()) { toast("Enter the final total", "error"); return; }
    start(async () => {
      const res = await createManualSale(v);
      if (res.error) toast(res.error, "error");
      else { toast("Sale added"); setV({ ...empty, sale_date: v.sale_date }); setAutoTotal(true); setSubmitted(false); router.refresh(); }
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5"><Label htmlFor="ms-date">Date</Label><Input id="ms-date" type="date" value={v.sale_date} onChange={set("sale_date")} /></div>
      <div className="space-y-1.5"><Label htmlFor="ms-item">Item name</Label><Input id="ms-item" value={v.item_name} onChange={set("item_name")} placeholder="e.g. Cappuccino" /></div>
      <div className="space-y-1.5">
        <Label htmlFor="ms-cat">Category</Label>
        <Input id="ms-cat" value={v.category} onChange={set("category")} placeholder="e.g. Beverages" list="sale-categories" autoComplete="off" />
        <datalist id="sale-categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ms-pay">Payment</Label>
        <select id="ms-pay" className={sel} value={v.payment_type} onChange={set("payment_type")}>
          <option>Cash</option><option>UPI</option><option>Card</option><option>Other</option>
        </select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="ms-inv">Invoice no.</Label><Input id="ms-inv" value={v.invoice_no} onChange={set("invoice_no")} placeholder="optional" /></div>
      <div className="space-y-1.5">
        <Label htmlFor="ms-qty">Qty</Label>
        <Input id="ms-qty" type="number" min="1" value={v.qty} onChange={set("qty")} aria-invalid={submitted && qtyBad} aria-describedby={submitted && qtyBad ? "ms-qty-error" : undefined} />
        {submitted && qtyBad && <p id="ms-qty-error" className="text-xs text-destructive">Quantity must be at least 1</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ms-price">Price</Label>
        <Input id="ms-price" type="number" step="0.01" min="0" value={v.price} onChange={set("price")} placeholder="0" aria-invalid={submitted && priceBad} aria-describedby={submitted && priceBad ? "ms-price-error" : undefined} />
        {submitted && priceBad && <p id="ms-price-error" className="text-xs text-destructive">Price cannot be negative</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ms-total">Final total (₹)</Label>
        <Input id="ms-total" type="number" step="0.01" value={v.final_total} onChange={onFinalTotal} placeholder="0" aria-describedby="ms-total-hint" />
        <p id="ms-total-hint" className="text-xs text-muted-foreground">Auto-calculated from Price × Qty. Edit to apply discounts.</p>
      </div>
      <div className="flex items-end lg:col-span-4">
        <Button onClick={submit} disabled={pending}>{pending ? "Adding…" : "Add sale"}</Button>
      </div>
    </div>
  );
}
