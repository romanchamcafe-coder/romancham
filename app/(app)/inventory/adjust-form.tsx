"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAdjustment } from "@/server/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

type Item = { id: string; name: string };
const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function AdjustForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ingredientId, setIngredientId] = useState("");
  const [direction, setDirection] = useState("add");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("count");
  const [note, setNote] = useState("");

  const reset = () => { setErr(null); setIngredientId(""); setDirection("add"); setQty(""); setReason("count"); setNote(""); };

  function submit() {
    setErr(null);
    if (!ingredientId) { setErr("Select an item"); return; }
    if (!qty || Number(qty) <= 0) { setErr("Enter a quantity greater than 0"); return; }
    start(async () => {
      const res = await createAdjustment({ ingredient_id: ingredientId, direction: direction as "add" | "reduce", qty: Number(qty), reason, note });
      if (res?.error) setErr(res.error);
      else { toast("Stock adjusted"); reset(); setOpen(false); router.refresh(); }
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>+ Stock Adjustment</Button>
      <Dialog
        open={open}
        onClose={() => { setOpen(false); setErr(null); }}
        title="Stock Adjustment"
        description="Manually correct on-hand stock (physical count, damage, expiry…)."
        footer={
          <>
            <Button variant="outline" onClick={() => { setOpen(false); setErr(null); }} disabled={pending}>Cancel</Button>
            <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save Adjustment"}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="adj-item">Item</Label>
            <select id="adj-item" value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className={sel} aria-label="Item">
              <option value="">Select…</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-dir">Direction</Label>
            <select id="adj-dir" value={direction} onChange={(e) => setDirection(e.target.value)} className={sel} aria-label="Adjustment direction">
              <option value="add">Add (+)</option>
              <option value="reduce">Remove (−)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-qty">Quantity</Label>
            <Input id="adj-qty" type="number" step="0.0001" min="0" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-reason">Reason</Label>
            <select id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={sel} aria-label="Reason">
              <option value="count">Physical count</option>
              <option value="damage">Damage</option>
              <option value="expiry">Expiry</option>
              <option value="theft">Theft / loss</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-note">Note</Label>
            <Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" aria-label="Note" />
          </div>
        </div>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
      </Dialog>
    </>
  );
}
