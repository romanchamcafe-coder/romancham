"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logWastage } from "@/server/actions/operations";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WASTAGE_REASONS } from "@/lib/ops/checklists";

type Item = { id: string; name: string; unit: string; cost: number };
const sel = "h-11 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function WastageForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [itemId, setItemId] = useState("");
  const [freeText, setFreeText] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [unitCost, setUnitCost] = useState(0);
  const [cost, setCost] = useState("");
  const [costTouched, setCostTouched] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const pickItem = (id: string) => {
    setItemId(id);
    const it = items.find((i) => i.id === id);
    if (it) { setUnit(it.unit); setUnitCost(it.cost); if (!costTouched) setCost(qty ? String(round(it.cost * Number(qty))) : ""); }
  };
  const onQty = (v: string) => {
    setQty(v);
    if (!costTouched && itemId && unitCost) setCost(v ? String(round(unitCost * Number(v))) : "");
  };
  const round = (n: number) => Math.round(n * 100) / 100;

  const submit = () => {
    setErr(null);
    const item_name = itemId ? (items.find((i) => i.id === itemId)?.name ?? "") : freeText.trim();
    if (!item_name) { setErr("Pick an item or type a name"); return; }
    if (!qty || Number(qty) <= 0) { setErr("Enter a quantity"); return; }
    if (!reason) { setErr("Choose a reason"); return; }
    start(async () => {
      const res = await logWastage({ ingredient_id: itemId || undefined, item_name, qty, unit, reason, cost, note });
      if (res?.error) { setErr(res.error); return; }
      toast("Wastage logged");
      setItemId(""); setFreeText(""); setQty(""); setUnit(""); setUnitCost(0); setCost(""); setCostTouched(false); setReason(""); setNote("");
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-3 text-sm font-semibold">Log wastage</p>
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label>Item</Label>
          <select value={itemId} onChange={(e) => pickItem(e.target.value)} className={sel} aria-label="Item">
            <option value="">— pick from inventory —</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          {!itemId && (
            <Input value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="…or type an item name" aria-label="Item name" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Quantity {unit ? <span className="text-xs font-normal text-muted-foreground">({unit})</span> : null}</Label>
            <Input type="number" inputMode="decimal" step="0.01" min="0" value={qty} onChange={(e) => onQty(e.target.value)} placeholder="0" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>Cost (₹)</Label>
            <Input type="number" inputMode="decimal" step="0.01" min="0" value={cost} onChange={(e) => { setCostTouched(true); setCost(e.target.value); }} placeholder="0" className="h-11" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={sel} aria-label="Reason">
            <option value="">— choose —</option>
            {WASTAGE_REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Note <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" className="h-11" />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="h-12 text-base" onClick={submit} disabled={pending}>{pending ? "Saving…" : "Log wastage"}</Button>
      </div>
    </div>
  );
}
