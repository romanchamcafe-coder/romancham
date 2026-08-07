"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { ReqItem } from "@/server/queries/requests";

export type PickRow = { ingredient_id: string; qty: string };
const sel = "h-11 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function ItemsPicker({ items, rows, setRows }: { items: ReqItem[]; rows: PickRow[]; setRows: (r: PickRow[]) => void }) {
  const low = items.filter((i) => i.low);
  const add = (ingredient_id = "", qty = "") => setRows([...rows, { ingredient_id, qty }]);
  const update = (i: number, patch: Partial<PickRow>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const suggest = (it: ReqItem) => { const s = it.max > it.reorder ? it.max - it.qty : it.reorder; return String(Math.max(0, Math.round(s * 100) / 100) || it.reorder || 1); };
  const unitOf = (id: string) => items.find((i) => i.id === id)?.unit ?? "";

  return (
    <div className="space-y-3">
      {low.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-amber-700">Low stock — tap to add</p>
          <div className="flex flex-wrap gap-2">
            {low.map((it) => (
              <button key={it.id} type="button"
                onClick={() => { if (!rows.some((r) => r.ingredient_id === it.id)) add(it.id, suggest(it)); }}
                className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 active:scale-95">
                + {it.name} <span className="text-amber-600">({it.qty}{it.unit ? ` ${it.unit}` : ""})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={r.ingredient_id} onChange={(e) => update(i, { ingredient_id: e.target.value })} className={sel} aria-label="Item">
              <option value="">— item —</option>
              {items.map((it) => <option key={it.id} value={it.id}>{it.name}{it.low ? " · low" : ""}</option>)}
            </select>
            <div className="relative w-28 shrink-0">
              <Input type="number" inputMode="decimal" step="0.01" min="0" value={r.qty} onChange={(e) => update(i, { qty: e.target.value })} placeholder="qty" className="h-11 pr-8" aria-label="Quantity" />
              {r.ingredient_id && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unitOf(r.ingredient_id)}</span>}
            </div>
            <button type="button" onClick={() => remove(i)} className="flex h-11 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive" aria-label="Remove row">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" className="h-11 w-full" onClick={() => add()}>
        <Plus className="mr-1 h-4 w-4" /> Add item
      </Button>
    </div>
  );
}
