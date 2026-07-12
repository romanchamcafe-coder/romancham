"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postProduction } from "@/server/actions/production";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import type { StockItem } from "@/server/queries/production";

const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function ProductionForm({ items }: { items: StockItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [on, setOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const selected = items.find((i) => i.id === itemId);

  function submit() {
    setErr(null);
    if (!itemId) { setErr("Select a finished good"); return; }
    if (!qty || Number(qty) <= 0) { setErr("Enter a quantity greater than 0"); return; }
    start(async () => {
      const res = await postProduction({ sales_item_id: itemId, qty, produced_on: on, note });
      if (res?.error) setErr(res.error);
      else { toast("Batch recorded — raw consumed, finished stock added"); setQty(""); setNote(""); router.refresh(); }
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="pr-item">Finished good</Label>
          <select id="pr-item" value={itemId} onChange={(e) => setItemId(e.target.value)} className={sel} aria-label="Finished good">
            <option value="">Select…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pr-qty">Quantity produced {selected ? <span className="text-xs font-normal text-muted-foreground">({selected.uom})</span> : null}</Label>
          <Input id="pr-qty" type="number" step="0.0001" min="0" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 50" aria-label="Quantity produced" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pr-date">Produced on</Label>
          <Input id="pr-date" type="date" value={on} onChange={(e) => setOn(e.target.value)} aria-label="Produced on" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pr-note">Note</Label>
          <Input id="pr-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" aria-label="Note" />
        </div>
      </div>
      {selected && selected.components === 0 && (
        <p className="mt-2 text-sm text-amber-600">This item has no recipe yet — the batch will add finished stock but won&apos;t deduct any raw materials. Add its recipe in Recipes to consume ingredients.</p>
      )}
      <div className="mt-3 flex items-center justify-end gap-3">
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button onClick={submit} disabled={pending}>{pending ? "Recording…" : "Record batch"}</Button>
      </div>
    </div>
  );
}
