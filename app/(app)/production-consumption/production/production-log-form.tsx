"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { postProductionBatch } from "@/server/actions/pnc";
import type { PncItem } from "@/server/queries/pnc";

const sel = "h-12 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function ProductionLogForm({ items }: { items: PncItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [id, setId] = useState("");
  const [planned, setPlanned] = useState("");
  const [yield_, setYield] = useState("");
  const [portions, setPortions] = useState("");
  const [expiry, setExpiry] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const item = items.find((i) => i.id === id) || null;

  function submit() {
    setErr(null);
    if (!id) { setErr("Select a finished good"); return; }
    if (!Number(yield_) || Number(yield_) <= 0) { setErr("Enter an actual yield greater than 0"); return; }
    start(async () => {
      const res = await postProductionBatch({ sales_item_id: id, planned_qty: planned, actual_yield: yield_, portions_per_unit: portions, expiry_date: expiry, production_date: date, note });
      if (res?.error) setErr(res.error);
      else { toast("Batch recorded — raw consumed, added to Store"); setPlanned(""); setYield(""); setPortions(""); setExpiry(""); setNote(""); router.refresh(); }
    });
  }

  return (
    <Card>
      <div className="space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="b-item">Finished good</Label>
          <select id="b-item" value={id} onChange={(e) => setId(e.target.value)} className={sel} aria-label="Finished good">
            <option value="">Select a product…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.components === 0 ? " (no recipe)" : ""}</option>)}
          </select>
          {item && (
            <p className="text-xs text-muted-foreground">
              {item.components > 0 ? `${item.components} ingredient${item.components > 1 ? "s" : ""} in recipe · ` : "No recipe — won't consume raw · "}
              In store: <b>{item.store} {item.uom}</b> · On display: <b>{item.display} {item.uom}</b>
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-plan">Planned qty {item ? <span className="text-xs font-normal text-muted-foreground">({item.uom})</span> : null}</Label>
            <Input id="b-plan" className="h-12 text-base" type="number" step="0.0001" min="0" inputMode="decimal" value={planned} onChange={(e) => setPlanned(e.target.value)} placeholder="e.g. 20" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-yield">Actual yield {item ? <span className="text-xs font-normal text-muted-foreground">({item.uom})</span> : null}</Label>
            <Input id="b-yield" className="h-12 text-base" type="number" step="0.0001" min="0" inputMode="decimal" value={yield_} onChange={(e) => setYield(e.target.value)} placeholder="e.g. 18" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-portions">Portions / unit <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="b-portions" className="h-12 text-base" type="number" step="0.01" min="0" inputMode="decimal" value={portions} onChange={(e) => setPortions(e.target.value)} placeholder="e.g. 8 slices" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-expiry">Expiry date</Label>
            <Input id="b-expiry" className="h-12 text-base" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-date">Production date</Label>
            <Input id="b-date" className="h-12 text-base" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-note">Note</Label>
            <Input id="b-note" className="h-12 text-base" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
          </div>
        </div>

        {item && item.components === 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400">This item has no recipe yet — the batch adds finished stock but won&apos;t deduct raw materials.</p>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="h-12 w-full text-base sm:w-auto" onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save batch"}</Button>
      </div>
    </Card>
  );
}
