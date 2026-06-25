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
type Branch = { id: string; name: string };
type Ingredient = {
  id: string; name: string; default_gst_rate: number; default_vendor_id: string;
  category_name: string; uom: string; last_price: number;
};
type Line = { category: string; ingredient_id: string; uom: string; qty: string; rate: string; with_gst: string };

const blank: Line = { category: "", ingredient_id: "", uom: "", qty: "1", rate: "", with_gst: "" };
const fieldCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function PurchaseForm({ vendors, ingredients, branches, defaultBranchId }: {
  vendors: Vendor[]; ingredients: Ingredient[]; branches: Branch[]; defaultBranchId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState("credit");
  const [vendorId, setVendorId] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || "");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([{ ...blank }]);

  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const num = (v: string) => Number(v) || 0;
  const withoutGst = (l: Line) => num(l.qty) * num(l.rate);

  function onProduct(i: number, id: string) {
    const ing = ingredients.find((x) => x.id === id);
    setLines((ls) => ls.map((l, idx) => {
      if (idx !== i) return l;
      const rate = ing && ing.last_price ? String(ing.last_price) : l.rate;
      const base = num(l.qty) * num(rate);
      const withGst = ing && ing.default_gst_rate ? (base * (1 + ing.default_gst_rate / 100)).toFixed(2) : l.with_gst;
      return { ...l, ingredient_id: id, category: ing?.category_name || l.category, uom: ing?.uom || l.uom, rate, with_gst: withGst };
    }));
    if (ing?.default_vendor_id && !vendorId) setVendorId(ing.default_vendor_id);
  }

  function recalcWith(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => {
      if (idx !== i) return l;
      const merged = { ...l, ...patch };
      const ing = ingredients.find((x) => x.id === merged.ingredient_id);
      const base = num(merged.qty) * num(merged.rate);
      if (ing && ing.default_gst_rate && base > 0) merged.with_gst = (base * (1 + ing.default_gst_rate / 100)).toFixed(2);
      return merged;
    }));
  }

  const totalWithout = lines.reduce((s, l) => s + withoutGst(l), 0);
  const totalWith = lines.reduce((s, l) => s + (num(l.with_gst) || withoutGst(l)), 0);
  const totalGst = totalWith - totalWithout;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createPurchase({
        vendor_id: vendorId,
        branch_id: branchId,
        payment_mode: paymentMode as "petty_cash" | "credit",
        bill_no: billNo,
        bill_date: billDate,
        items: lines.map((l) => ({
          ingredient_id: l.ingredient_id, category: l.category, uom: l.uom,
          qty: num(l.qty), rate: num(l.rate), with_gst: l.with_gst ? num(l.with_gst) : undefined,
        })),
      });
      if (res?.error) setError(res.error);
      else router.push("/purchases");
    });
  }

  return (
    <Card><CardContent className="space-y-4 pt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label>Petty cash/Credit</Label>
          <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={fieldCls}>
            <option value="credit">Credit</option><option value="petty_cash">Petty Cash</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Vendor</Label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={fieldCls}>
            <option value="">Select vendor…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Location</Label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={fieldCls}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>Invoice No</Label><Input className="h-9" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="optional" /></div>
        <div className="space-y-1.5"><Label>Bill Date</Label><Input className="h-9" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-2 py-2 font-medium">Category</th>
              <th className="px-2 py-2 font-medium">Product</th>
              <th className="px-2 py-2 font-medium">UOM</th>
              <th className="px-2 py-2 font-medium">Qty</th>
              <th className="px-2 py-2 font-medium">Per pcs</th>
              <th className="px-2 py-2 text-right font-medium">Without GST</th>
              <th className="px-2 py-2 font-medium">With GST</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-1.5"><Input className="h-9 w-28" value={l.category} onChange={(e) => update(i, { category: e.target.value })} placeholder="auto" /></td>
                <td className="p-1.5">
                  <select value={l.ingredient_id} onChange={(e) => onProduct(i, e.target.value)} className={fieldCls + " min-w-44"}>
                    <option value="">Select…</option>
                    {ingredients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </td>
                <td className="p-1.5"><Input className="h-9 w-20" value={l.uom} onChange={(e) => update(i, { uom: e.target.value })} placeholder="auto" /></td>
                <td className="p-1.5"><Input className="h-9 w-20" type="number" step="0.0001" value={l.qty} onChange={(e) => recalcWith(i, { qty: e.target.value })} /></td>
                <td className="p-1.5"><Input className="h-9 w-24" type="number" step="0.01" value={l.rate} onChange={(e) => recalcWith(i, { rate: e.target.value })} /></td>
                <td className="p-1.5 text-right tabular-nums">{inr(withoutGst(l))}</td>
                <td className="p-1.5"><Input className="h-9 w-28" type="number" step="0.01" value={l.with_gst} onChange={(e) => update(i, { with_gst: e.target.value })} placeholder="incl. GST" /></td>
                <td className="p-1.5 text-center">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2">
          <Button variant="outline" size="sm" type="button" onClick={() => setLines((ls) => [...ls, { ...blank }])}>+ Add row</Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Without GST <span className="font-medium text-foreground">{inr(totalWithout)}</span> · GST <span className="font-medium text-foreground">{inr(totalGst)}</span> · With GST <span className="font-semibold text-foreground">{inr(totalWith)}</span>
          <div className="text-xs">Category, UOM, GST &amp; price auto-fill from the Material master when you pick a product.</div>
        </div>
        <Button onClick={submit} disabled={pending} className="sm:w-44">{pending ? "Saving…" : "Save Purchase"}</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </CardContent></Card>
  );
}
