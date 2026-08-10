"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchase, updatePurchase } from "@/server/actions/purchases";
import type { FormIngredient, FormUnit } from "@/server/queries/purchases";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inr } from "@/lib/utils";
import { Trash2 } from "lucide-react";

type Vendor = { id: string; name: string };
type Branch = { id: string; name: string };
type Line = {
  category: string; ingredient_id: string; purchase_uom: string;
  pack_qty: string; pack_size: string; pack_size_unit_id: string; unit_price: string; gst_rate: string;
};

const blank: Line = {
  category: "", ingredient_id: "", purchase_uom: "", pack_qty: "1", pack_size: "", pack_size_unit_id: "", unit_price: "", gst_rate: "",
};
const fieldCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const PACKAGING = ["Packet", "Bottle", "Bag", "Tin", "Can", "Box", "Tray", "Jar", "Pouch", "Sachet", "Carton", "Piece"];
const MEAS = new Set(["g", "gms", "kg", "ml", "l", "lts", "ltr", "qty", "pcs", "pc", "dz"]);

const num = (v: string) => Number(v) || 0;

// Mirror of SQL to_base_qty: convert a pack-size value into the product's base unit.
function toBase(value: number, fromFactor: number, baseFactor: number, sameUnit: boolean) {
  if (sameUnit || !fromFactor || !baseFactor) return value;
  return (value * fromFactor) / baseFactor;
}

// Human-friendly base quantity, e.g. 1500 g -> "1.5 kg", 1000 ml -> "1 L".
function fmtQty(base: number, baseAbbr: string) {
  const a = (baseAbbr || "").toLowerCase();
  if ((a === "g" || a === "gms") && base >= 1000) return `${trim(base / 1000)} kg`;
  if (a === "ml" && base >= 1000) return `${trim(base / 1000)} L`;
  return `${trim(base)} ${baseAbbr}`.trim();
}
const trim = (n: number) => (Math.round(n * 10000) / 10000).toString();

export type EditInitial = {
  vendor_id: string; branch_id: string; payment_mode: string; bill_no: string; bill_date: string;
  lines: Line[];
};

export function PurchaseForm({ vendors, ingredients, branches, units, defaultBranchId, mode = "create", purchaseId, initial }: {
  vendors: Vendor[]; ingredients: FormIngredient[]; branches: Branch[]; units: FormUnit[]; defaultBranchId: string;
  mode?: "create" | "edit"; purchaseId?: string; initial?: EditInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState(initial?.payment_mode || "credit");
  const [vendorId, setVendorId] = useState(initial?.vendor_id || "");
  const [branchId, setBranchId] = useState(initial?.branch_id || defaultBranchId || branches[0]?.id || "");
  const [billNo, setBillNo] = useState(initial?.bill_no || "");
  const [billDate, setBillDate] = useState(initial?.bill_date || new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>(initial?.lines?.length ? initial.lines.map((l) => ({ ...l })) : [{ ...blank }]);

  const measUnits = units.filter((u) => MEAS.has(u.abbr.toLowerCase()));
  const packUnitOptions = measUnits.length ? measUnits : units;
  const unitById = new Map(units.map((u) => [u.id, u]));

  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  function onProduct(i: number, id: string) {
    const ing = ingredients.find((x) => x.id === id);
    update(i, {
      ingredient_id: id,
      category: ing?.category_name || lines[i].category,
      pack_size_unit_id: lines[i].pack_size_unit_id || ing?.base_unit_id || "",
      gst_rate: lines[i].gst_rate || (ing?.default_gst_rate ? String(ing.default_gst_rate) : ""),
    });
    if (ing?.default_vendor_id && !vendorId) setVendorId(ing.default_vendor_id);
  }

  // Per-line derived figures.
  function calc(l: Line) {
    const ing = ingredients.find((x) => x.id === l.ingredient_id);
    const packUnit = unitById.get(l.pack_size_unit_id);
    const baseAbbr = ing?.base_uom || packUnit?.abbr || "";
    const baseFactor = ing?.base_factor || 1;
    const sameUnit = !l.pack_size_unit_id || l.pack_size_unit_id === ing?.base_unit_id;
    const packBase = toBase(num(l.pack_size), packUnit?.factor_to_base || 1, baseFactor, sameUnit);
    const totalQty = num(l.pack_qty) * packBase;
    const subtotal = num(l.pack_qty) * num(l.unit_price);
    const gst = subtotal * num(l.gst_rate) / 100;
    return { baseAbbr, totalQty, subtotal, gst, grand: subtotal + gst };
  }

  const totals = lines.reduce((acc, l) => {
    const c = calc(l);
    acc.sub += c.subtotal; acc.gst += c.gst; acc.grand += c.grand;
    return acc;
  }, { sub: 0, gst: 0, grand: 0 });

  function submit() {
    setError(null);
    const payload = {
      vendor_id: vendorId,
      branch_id: branchId,
      payment_mode: paymentMode as "petty_cash" | "credit",
      bill_no: billNo,
      bill_date: billDate,
      items: lines.map((l) => {
        const ing = ingredients.find((x) => x.id === l.ingredient_id);
        return {
          ingredient_id: l.ingredient_id,
          category: l.category,
          purchase_uom: l.purchase_uom,
          pack_qty: num(l.pack_qty),
          pack_size: num(l.pack_size),
          pack_size_unit_id: l.pack_size_unit_id || ing?.base_unit_id || "",
          unit_price: num(l.unit_price),
          gst_rate: num(l.gst_rate),
          uom: ing?.base_uom || "",
        };
      }),
    };
    startTransition(async () => {
      const res = mode === "edit" && purchaseId
        ? await updatePurchase(purchaseId, payload)
        : await createPurchase(payload);
      if (res?.error) setError(res.error);
      else router.push("/purchases");
    });
  }

  return (
    <Card><CardContent className="space-y-4 pt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label>Petty cash/Credit</Label>
          <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={fieldCls} aria-label="Payment mode: petty cash or credit">
            <option value="credit">Credit</option><option value="petty_cash">Petty Cash</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Vendor</Label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={fieldCls} aria-label="Vendor">
            <option value="">Select vendor…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Location</Label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={fieldCls} aria-label="Location">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>Invoice No</Label><Input className="h-9" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="optional" aria-label="Invoice number" /></div>
        <div className="space-y-1.5"><Label>Bill Date</Label><Input className="h-9" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} aria-label="Bill date" /></div>
      </div>

      <datalist id="packaging-options">
        {PACKAGING.map((p) => <option key={p} value={p} />)}
      </datalist>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-2 py-2 font-medium">Product</th>
              <th className="px-2 py-2 font-medium">Packaging</th>
              <th className="px-2 py-2 font-medium">Pack Size</th>
              <th className="px-2 py-2 font-medium">Purchase Qty</th>
              <th className="px-2 py-2 font-medium">Unit Price</th>
              <th className="px-2 py-2 font-medium">GST %</th>
              <th className="px-2 py-2 font-medium">Total Qty</th>
              <th className="px-2 py-2 text-right font-medium">Without GST</th>
              <th className="px-2 py-2 text-right font-medium">With GST</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const c = calc(l);
              return (
                <tr key={i} className="border-b last:border-0 align-top">
                  <td className="p-1.5">
                    <select value={l.ingredient_id} onChange={(e) => onProduct(i, e.target.value)} className={fieldCls + " min-w-44"} aria-label="Product">
                      <option value="">Select…</option>
                      {ingredients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    {l.category && <div className="mt-1 px-1 text-xs text-muted-foreground">{l.category}</div>}
                  </td>
                  <td className="p-1.5">
                    <Input list="packaging-options" className="h-9 w-28" value={l.purchase_uom} onChange={(e) => update(i, { purchase_uom: e.target.value })} placeholder="Packet" aria-label="Packaging" />
                  </td>
                  <td className="p-1.5">
                    <div className="flex gap-1">
                      <Input className="h-9 w-16" type="number" step="0.0001" min="0" value={l.pack_size} onChange={(e) => update(i, { pack_size: e.target.value })} placeholder="500" aria-label="Pack size value" />
                      <select value={l.pack_size_unit_id} onChange={(e) => update(i, { pack_size_unit_id: e.target.value })} className={fieldCls + " w-20"} aria-label="Pack size unit">
                        <option value="">unit</option>
                        {packUnitOptions.map((u) => <option key={u.id} value={u.id}>{u.abbr}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="p-1.5"><Input className="h-9 w-20" type="number" step="0.0001" min="0" value={l.pack_qty} onChange={(e) => update(i, { pack_qty: e.target.value })} aria-label="Purchase quantity (packages)" /></td>
                  <td className="p-1.5"><Input className="h-9 w-24" type="number" step="0.01" min="0" value={l.unit_price} onChange={(e) => update(i, { unit_price: e.target.value })} placeholder="₹ / pack" aria-label="Unit price per package" /></td>
                  <td className="p-1.5"><Input className="h-9 w-16" type="number" step="0.01" min="0" value={l.gst_rate} onChange={(e) => update(i, { gst_rate: e.target.value })} placeholder="5" aria-label="GST percent" /></td>
                  <td className="p-1.5 text-sm font-medium tabular-nums">{l.ingredient_id && num(l.pack_qty) > 0 && num(l.pack_size) > 0 ? fmtQty(c.totalQty, c.baseAbbr) : "—"}</td>
                  <td className="p-1.5 text-right tabular-nums">{inr(c.subtotal)}</td>
                  <td className="p-1.5 text-right tabular-nums">{inr(c.grand)}</td>
                  <td className="p-1.5 text-center">
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive" aria-label="Remove row">
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
          Subtotal <span className="font-medium text-foreground">{inr(totals.sub)}</span> · GST <span className="font-medium text-foreground">{inr(totals.gst)}</span> · Grand Total <span className="font-semibold text-foreground">{inr(totals.grand)}</span>
          <div className="text-xs">Enter the number of packages and the price per package — the system works out the total quantity and inventory.</div>
        </div>
        <Button onClick={submit} disabled={pending} className="sm:w-44">{pending ? "Saving…" : mode === "edit" ? "Save changes" : "Save Purchase"}</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </CardContent></Card>
  );
}
