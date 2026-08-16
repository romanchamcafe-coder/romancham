"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/utils";

type RawRow = { id: string; name: string; uom: string; opening: number; purchased: number; consumed: number; backflushed: number; wastage: number; closing: number; physical: number; varianceQty: number; variancePct: number };
type BatchRow = { code: string; onHand: number; ageDays: number; expiry: string | null; expiresInDays: number | null };
type FinRow = { id: string; name: string; uom: string; opening: number; produced: number; transferIn: number; transferOut: number; sold: number; wasted: number; closing: number; closingValue: number; batches: BatchRow[] };
type ReconRow = { id: string; name: string; uom: string; opening: number; produced: number; available: number; sold: number; sellThrough: number; closing: number; daysCover: number | null; oldestDays: number; nearestExpiry: number | null; flags: string[] };

const n = (v: number) => Math.round(v * 100) / 100;

export function ReportTabs({ raw, finished, recon }: { raw: RawRow[]; finished: FinRow[]; recon: ReconRow[] }) {
  const [tab, setTab] = useState<"raw" | "finished" | "recon">("raw");
  const tabs: { k: typeof tab; l: string }[] = [
    { k: "raw", l: "Raw Material Consumption" },
    { k: "finished", l: "Finished Goods Movement" },
    { k: "recon", l: "Production vs Sales" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={"px-3 py-2 text-sm font-medium -mb-px border-b-2 " + (tab === t.k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "raw" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2">Ingredient</th><th className="px-3 py-2 text-right">Opening</th><th className="px-3 py-2 text-right">Purchased</th><th className="px-3 py-2 text-right">Consumed</th><th className="px-3 py-2 text-right">Backflushed</th><th className="px-3 py-2 text-right">Wastage</th><th className="px-3 py-2 text-right">Closing</th><th className="px-3 py-2 text-right">Physical</th><th className="px-3 py-2 text-right">Var qty</th><th className="px-3 py-2 text-right">Var %</th></tr>
            </thead>
            <tbody>
              {raw.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No raw-material movement in this period.</td></tr>}
              {raw.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium">{r.name} <span className="text-xs text-muted-foreground">{r.uom}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.opening)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.purchased)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.consumed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.backflushed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.wastage)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{n(r.closing)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.physical)}</td>
                  <td className={"px-3 py-2 text-right tabular-nums " + (Math.abs(r.varianceQty) > 0.001 ? "text-red-600 dark:text-red-400" : "")}>{n(r.varianceQty)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.variancePct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">Sorted by largest absolute variance. Variance = physical stock − expected closing.</p>
        </Card>
      )}

      {tab === "finished" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Opening</th><th className="px-3 py-2 text-right">Produced</th><th className="px-3 py-2 text-right">Trf In</th><th className="px-3 py-2 text-right">Trf Out</th><th className="px-3 py-2 text-right">Sold</th><th className="px-3 py-2 text-right">Wasted</th><th className="px-3 py-2 text-right">Closing</th><th className="px-3 py-2 text-right">Closing ₹</th></tr>
            </thead>
            <tbody>
              {finished.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No finished-goods movement in this period.</td></tr>}
              {finished.map((f) => (
                <FinishedRow key={f.id} f={f} />
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">Click a row to expand batch age &amp; expiry.</p>
        </Card>
      )}

      {tab === "recon" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Opening</th><th className="px-3 py-2 text-right">Produced</th><th className="px-3 py-2 text-right">Available</th><th className="px-3 py-2 text-right">Sold</th><th className="px-3 py-2 text-right">Sell-through</th><th className="px-3 py-2 text-right">Closing</th><th className="px-3 py-2 text-right">Days cover</th><th className="px-3 py-2">Alerts</th></tr>
            </thead>
            <tbody>
              {recon.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No production to reconcile in this period.</td></tr>}
              {recon.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.opening)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.produced)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.available)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.sold)}</td>
                  <td className={"px-3 py-2 text-right tabular-nums " + (r.sellThrough < 40 && r.produced > 0 ? "text-red-600 dark:text-red-400" : r.sellThrough >= 80 ? "text-emerald-600 dark:text-emerald-400" : "")}>{Math.round(r.sellThrough)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.closing)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.daysCover == null ? "—" : Math.round(r.daysCover * 10) / 10}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.flags.includes("overproduced") && <Badge tone="red">Overproduced</Badge>}
                      {r.flags.includes("slow-moving") && <Badge tone="amber">Slow-moving</Badge>}
                      {r.flags.includes("ageing") && <Badge tone="amber">Ageing{r.nearestExpiry != null ? ` ${r.nearestExpiry}d` : ""}</Badge>}
                      {r.flags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">Sell-through = sold ÷ available. Low sell-through with high production = overproduction; long days-of-cover = slow-moving; near-expiry batches = ageing inventory.</p>
        </Card>
      )}
    </div>
  );
}

function FinishedRow({ f }: { f: FinRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-b cursor-pointer hover:bg-muted/40" onClick={() => setOpen((o) => !o)}>
        <td className="px-3 py-2 font-medium">{open ? "▾ " : "▸ "}{f.name} <span className="text-xs text-muted-foreground">{f.uom}</span></td>
        <td className="px-3 py-2 text-right tabular-nums">{n(f.opening)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{n(f.produced)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{n(f.transferIn)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{n(f.transferOut)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{n(f.sold)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{n(f.wasted)}</td>
        <td className="px-3 py-2 text-right tabular-nums font-medium">{n(f.closing)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{inr(f.closingValue)}</td>
      </tr>
      {open && f.batches.length > 0 && (
        <tr className="border-b bg-muted/20"><td colSpan={9} className="px-6 py-2">
          <div className="space-y-1 text-xs">
            {f.batches.map((b) => (
              <div key={b.code} className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{b.code}</span>
                <span className="text-muted-foreground">on hand {n(b.onHand)} · age {b.ageDays}d</span>
                {b.expiry && (b.expiresInDays != null && b.expiresInDays <= 3 ? <Badge tone="red">exp {b.expiry} ({b.expiresInDays}d)</Badge> : <span className="text-muted-foreground">exp {b.expiry}</span>)}
              </div>
            ))}
          </div>
        </td></tr>
      )}
    </>
  );
}
