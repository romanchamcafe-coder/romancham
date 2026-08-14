"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { inr } from "@/lib/utils";
import { computePricing } from "@/lib/menu-pricing";
import { saveMenuPricing } from "@/server/actions/menu";
import type { MenuItem } from "@/server/queries/menu";

const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const money = (n: number) => inr(Math.round(n));
const round2 = (n: number) => Math.round(n * 100) / 100;

type Inputs = {
  packaging: string; wastage: string; labor: string; utility: string; overhead: string;
  marketing: string; commission: string; targetProfit: string; gst: string;
};
const EMPTY: Inputs = { packaging: "", wastage: "", labor: "", utility: "", overhead: "", marketing: "", commission: "", targetProfit: "", gst: "" };

export function MenuEngineering({ items }: { items: MenuItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [id, setId] = useState("");
  const [inp, setInp] = useState<Inputs>(EMPTY);

  const item = items.find((i) => i.id === id) || null;
  const recipeCost = item?.recipeCost ?? 0;

  function pick(newId: string) {
    setId(newId);
    const it = items.find((i) => i.id === newId);
    const p = it?.pricing;
    setInp(p ? {
      packaging: String(p.packaging_cost || ""), wastage: String(p.wastage_pct || ""), labor: String(p.labor_cost || ""),
      utility: String(p.utility_cost || ""), overhead: String(p.overhead_cost || ""), marketing: String(p.marketing_cost || ""),
      commission: String(p.commission_pct || ""), targetProfit: String(p.target_profit_pct || ""), gst: String(p.gst_pct || ""),
    } : EMPTY);
  }
  const set = (k: keyof Inputs) => (e: React.ChangeEvent<HTMLInputElement>) => setInp((s) => ({ ...s, [k]: e.target.value }));
  const num = (v: string) => Number(v) || 0;

  const r = useMemo(() => computePricing({
    recipeCost, packaging: num(inp.packaging), wastage: num(inp.wastage), labor: num(inp.labor),
    utility: num(inp.utility), overhead: num(inp.overhead), marketing: num(inp.marketing),
    commission: num(inp.commission), targetProfit: num(inp.targetProfit), gst: num(inp.gst),
  }), [recipeCost, inp]);

  function save() {
    if (!id) { toast("Select a sales item first", "error"); return; }
    start(async () => {
      const res = await saveMenuPricing(id, {
        packaging_cost: num(inp.packaging), wastage_pct: num(inp.wastage), labor_cost: num(inp.labor),
        utility_cost: num(inp.utility), overhead_cost: num(inp.overhead), marketing_cost: num(inp.marketing),
        commission_pct: num(inp.commission), target_profit_pct: num(inp.targetProfit), gst_pct: num(inp.gst),
        dine_price: round2(r.dinePrice), takeaway_price: round2(r.takeawayPrice), delivery_price: round2(r.deliveryPrice),
      });
      if (res?.error) toast(res.error, "error");
      else { toast("Menu pricing saved"); router.refresh(); }
    });
  }

  // Render function (not a nested component) so inputs keep focus while typing.
  const field = (label: string, k: keyof Inputs, suffix?: string) => (
    <div key={k} className="space-y-1.5">
      <Label htmlFor={`mp-${k}`}>{label}</Label>
      <div className="relative">
        <Input id={`mp-${k}`} type="number" step="0.01" min="0" value={inp[k]} onChange={set(k)} placeholder="0" className={suffix ? "pr-8" : ""} />
        {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <Card><CardContent className="space-y-4 pt-6">
      <div className="max-w-sm space-y-1.5">
        <Label>Sales item</Label>
        <select value={id} onChange={(e) => pick(e.target.value)} className={sel}>
          <option value="">Select a sales item…</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.hasRecipe ? "" : " (no recipe yet)"}</option>)}
        </select>
      </div>

      {id && (
        <>
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            Recipe cost (from ingredients): <span className="font-semibold text-foreground">{inr(round2(recipeCost))}</span>
            {!item?.hasRecipe && <span className="ml-2 text-amber-600 dark:text-amber-400">— build this item&apos;s recipe first for an accurate cost.</span>}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {field("Packaging cost", "packaging", "₹")}
            {field("Wastage", "wastage", "%")}
            {field("Labor cost", "labor", "₹")}
            {field("Utility cost", "utility", "₹")}
            {field("Overhead cost", "overhead", "₹")}
            {field("Marketing cost", "marketing", "₹")}
            {field("Commission (delivery)", "commission", "%")}
            {field("Target profit", "targetProfit", "%")}
            {field("GST", "gst", "%")}
          </div>

          {/* Cost build-up */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border">
              <div className="border-b bg-muted/50 px-3 py-2 text-sm font-medium">Cost build-up (per item)</div>
              <table className="w-full text-sm">
                <tbody>
                  <Row label="Recipe cost" v={money(recipeCost)} />
                  <Row label={`+ Wastage (${num(inp.wastage) || 0}%)`} v={money(r.recipeAfterWastage - recipeCost)} />
                  <Row label="+ Labor + Utility + Overhead + Marketing" v={money(r.overheads)} />
                  <Row label="Dine-in cost" v={money(r.dineCost)} strong />
                  <Row label="+ Packaging (takeaway/delivery)" v={money(num(inp.packaging))} />
                  <Row label="Takeaway / Delivery cost" v={money(r.otherCost)} strong />
                </tbody>
              </table>
            </div>

            {/* Suggested prices */}
            <div className="rounded-lg border">
              <div className="border-b bg-muted/50 px-3 py-2 text-sm font-medium">Suggested selling price (incl. GST)</div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="px-3 py-1.5">Channel</th><th className="px-3 py-1.5 text-right">Price</th><th className="px-3 py-1.5 text-right">Profit/item</th></tr>
                </thead>
                <tbody>
                  <PriceRow label="Dine-in" price={r.dinePrice} profit={r.dineProfit} />
                  <PriceRow label="Takeaway" price={r.takeawayPrice} profit={r.takeawayProfit} />
                  <PriceRow label="Delivery (Swiggy/Zomato)" price={r.deliveryPrice} profit={r.deliveryProfit} />
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-muted-foreground">Delivery price is grossed up so commission still leaves your target profit.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save pricing"}</Button>
          </div>
        </>
      )}
    </CardContent></Card>
  );
}

function Row({ label, v, strong }: { label: string; v: string; strong?: boolean }) {
  return (
    <tr className={"border-b last:border-0 " + (strong ? "font-semibold" : "")}>
      <td className="px-3 py-1.5">{label}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{v}</td>
    </tr>
  );
}
function PriceRow({ label, price, profit }: { label: string; price: number; profit: number }) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">{label}</td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">{inr(Math.round(price))}</td>
      <td className={"px-3 py-2 text-right tabular-nums " + (profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{inr(Math.round(profit))}</td>
    </tr>
  );
}
