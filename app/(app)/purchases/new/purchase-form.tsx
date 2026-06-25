"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchase } from "@/server/actions/purchases";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inr } from "@/lib/utils";
import { Trash2 } from "lucide-react";

type Vendor = { id: string; name: string };
type Ingredient = { id: string; name: string; default_gst_rate: number };
type Line = { ingredient_id: string; qty: string; rate: string; gst_rate: string };

const blank: Line = { ingredient_id: "", qty: "", rate: "", gst_rate: "" };
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function PurchaseForm({ vendors, ingredients }: { vendors: Vendor[]; ingredients: Ingredient[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [lines, setLines] = useState<Line[]>([{ ...blank }]);

  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  function onIngredient(i: number, id: string) {
    const ing = ingredients.find((x) => x.id === id);
    update(i, { ingredient_id: id, gst_rate: ing ? String(ing.default_gst_rate ?? 0) : "" });
  }

  const num = (v: string) => Number(v) || 0;
  const subtotal = lines.reduce((s, l) => s + num(l.qty) * num(l.rate), 0);
  const gst = lines.reduce((s, l) => s + num(l.qty) * num(l.rate) * num(l.gst_rate) / 100, 0);
  const total = subtotal + gst;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createPurchase({
        vendor_id: vendorId,
        bill_no: billNo,
        bill_date: billDate,
        due_date: dueDate || undefined,
        payment_status: paymentStatus as "unpaid" | "partial" | "paid",
        items: lines.map((l) => ({ ingredient_id: l.ingredient_id, qty: num(l.qty), rate: num(l.rate), gst_rate: num(l.gst_rate) })),
      });
      if (res?.error) setError(res.error);
      else router.push("/purchases");
    });
  }

  return (
    <Card><CardContent className="space-y-4 pt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Vendor</Label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={selectCls}>
            <option value="">Select vendor…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>Bill No</Label><Input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="optional" /></div>
        <div className="space-y-1.5"><Label>Bill Date</Label><Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Payment</Label>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={selectCls}>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-2 text-left font-medium">Ingredient</th>
              <th className="w-24 p-2 text-left font-medium">Qty</th>
              <th className="w-28 p-2 text-left font-medium">Rate (₹)</th>
              <th className="w-20 p-2 text-left font-medium">GST %</th>
              <th className="w-28 p-2 text-right font-medium">Line Total</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const lt = num(l.qty) * num(l.rate) * (1 + num(l.gst_rate) / 100);
              return (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-1.5">
                    <select value={l.ingredient_id} onChange={(e) => onIngredient(i, e.target.value)} className={selectCls}>
                      <option value="">Select…</option>
                      {ingredients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5"><Input className="h-9" type="number" step="0.0001" value={l.qty} onChange={(e) => update(i, { qty: e.target.value })} /></td>
                  <td className="p-1.5"><Input className="h-9" type="number" step="0.01" value={l.rate} onChange={(e) => update(i, { rate: e.target.value })} /></td>
                  <td className="p-1.5"><Input className="h-9" type="number" step="0.01" value={l.gst_rate} onChange={(e) => update(i, { gst_rate: e.target.value })} /></td>
                  <td className="p-1.5 text-right tabular-nums">{inr(lt)}</td>
                  <td className="p-1.5 text-center">
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
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
          <Button variant="outline" size="sm" type="button" onClick={() => setLines((ls) => [...ls, { ...blank }])}>+ Add row</Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Subtotal <span className="font-medium text-foreground">{inr(subtotal)}</span> · GST <span className="font-medium text-foreground">{inr(gst)}</span> · Total <span className="font-semibold text-foreground">{inr(total)}</span>
          <div className="text-xs">GST is split into CGST+SGST (same state) or IGST (inter-state) automatically from vendor &amp; branch state.</div>
        </div>
        <Button onClick={submit} disabled={pending} className="sm:w-44">{pending ? "Saving…" : "Save Purchase"}</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </CardContent></Card>
  );
}
