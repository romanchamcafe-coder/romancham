"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAdjustment } from "@/server/actions/inventory";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Item = { id: string; name: string };
const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function AdjustForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ingredientId, setIngredientId] = useState("");
  const [direction, setDirection] = useState("add");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("count");
  const [note, setNote] = useState("");

  function submit() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await createAdjustment({ ingredient_id: ingredientId, direction: direction as "add" | "reduce", qty: Number(qty), reason, note });
      if (res?.error) setErr(res.error);
      else { setMsg("Stock adjusted."); setIngredientId(""); setQty(""); setNote(""); router.refresh(); }
    });
  }

  if (!open) {
    return <Button variant="outline" onClick={() => setOpen(true)}>+ Stock Adjustment</Button>;
  }

  return (
    <Card><CardContent className="space-y-3 pt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label>Item</Label>
          <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className={sel} aria-label="Item">
            <option value="">Select…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Direction</Label>
          <select value={direction} onChange={(e) => setDirection(e.target.value)} className={sel} aria-label="Adjustment direction">
            <option value="add">Add (+)</option>
            <option value="reduce">Reduce (−)</option>
          </select>
        </div>
        <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" step="0.0001" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" /></div>
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={sel} aria-label="Reason">
            <option value="count">Physical count</option>
            <option value="damage">Damage</option>
            <option value="expiry">Expiry</option>
            <option value="theft">Theft / loss</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-1.5"><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" aria-label="Note" /></div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save Adjustment"}</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        {msg && <span className="text-sm text-green-600">{msg}</span>}
        {err && <span className="text-sm text-destructive">{err}</span>}
      </div>
    </CardContent></Card>
  );
}
