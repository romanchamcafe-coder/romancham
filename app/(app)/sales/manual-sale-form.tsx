"use client";
import { useState, useTransition } from "react";
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

export function ManualSaleForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<ManualSaleInput>(empty);
  const set = (k: keyof ManualSaleInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = () => {
    if (!v.item_name.trim()) { toast("Item name is required", "error"); return; }
    if (!v.final_total?.trim()) { toast("Enter the final total", "error"); return; }
    start(async () => {
      const res = await createManualSale(v);
      if (res.error) toast(res.error, "error");
      else { toast("Sale added"); setV({ ...empty, sale_date: v.sale_date }); router.refresh(); }
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5"><Label htmlFor="ms-date">Date</Label><Input id="ms-date" type="date" value={v.sale_date} onChange={set("sale_date")} /></div>
      <div className="space-y-1.5"><Label htmlFor="ms-item">Item name</Label><Input id="ms-item" value={v.item_name} onChange={set("item_name")} placeholder="e.g. Cappuccino" /></div>
      <div className="space-y-1.5"><Label htmlFor="ms-cat">Category</Label><Input id="ms-cat" value={v.category} onChange={set("category")} placeholder="e.g. Beverages" /></div>
      <div className="space-y-1.5">
        <Label htmlFor="ms-pay">Payment</Label>
        <select id="ms-pay" className={sel} value={v.payment_type} onChange={set("payment_type")}>
          <option>Cash</option><option>UPI</option><option>Card</option><option>Other</option>
        </select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="ms-inv">Invoice no.</Label><Input id="ms-inv" value={v.invoice_no} onChange={set("invoice_no")} placeholder="optional" /></div>
      <div className="space-y-1.5"><Label htmlFor="ms-qty">Qty</Label><Input id="ms-qty" type="number" value={v.qty} onChange={set("qty")} /></div>
      <div className="space-y-1.5"><Label htmlFor="ms-price">Price</Label><Input id="ms-price" type="number" step="0.01" value={v.price} onChange={set("price")} placeholder="0" /></div>
      <div className="space-y-1.5"><Label htmlFor="ms-total">Final total (₹)</Label><Input id="ms-total" type="number" step="0.01" value={v.final_total} onChange={set("final_total")} placeholder="0" /></div>
      <div className="flex items-end lg:col-span-4">
        <Button onClick={submit} disabled={pending}>{pending ? "Adding…" : "Add sale"}</Button>
      </div>
    </div>
  );
}
