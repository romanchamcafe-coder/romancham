"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { inr } from "@/lib/utils";
import { postWastage } from "@/server/actions/pnc";

const sel = "h-12 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const REASONS: { v: string; l: string }[] = [
  { v: "expired", l: "Expired" }, { v: "over_portioned", l: "Over-portioned" }, { v: "staff_meal", l: "Staff meal" },
  { v: "complimentary", l: "Complimentary" }, { v: "damaged", l: "Damaged" }, { v: "trial_batch", l: "Trial batch" },
  { v: "customer_return", l: "Customer return" }, { v: "quality_rejection", l: "Quality rejection" },
];

type Item = { id: string; name: string; uom: string; store: number; display: number; unitCost: number };

export function WastageForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [id, setId] = useState("");
  const [location, setLocation] = useState("display");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const item = items.find((i) => i.id === id) || null;
  const avail = item ? (location === "store" ? item.store : item.display) : 0;
  const value = item ? (Number(qty) || 0) * item.unitCost : 0;

  function submit() {
    setErr(null);
    if (!id) { setErr("Select a product"); return; }
    if (!reason) { setErr("Select a reason"); return; }
    if (!Number(qty) || Number(qty) <= 0) { setErr("Enter a quantity greater than 0"); return; }
    start(async () => {
      const res = await postWastage({ sales_item_id: id, qty, location, reason, notes });
      if (res?.error) setErr(res.error);
      else { toast("Wastage recorded"); setQty(""); setReason(""); setNotes(""); router.refresh(); }
    });
  }

  return (
    <Card>
      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="w-item">Product</Label>
            <select id="w-item" value={id} onChange={(e) => setId(e.target.value)} className={sel} aria-label="Product">
              <option value="">Select a product…</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-loc">Location</Label>
            <select id="w-loc" value={location} onChange={(e) => setLocation(e.target.value)} className={sel} aria-label="Location">
              <option value="display">Display</option>
              <option value="store">Store</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-qty">Quantity wasted {item ? <span className="text-xs font-normal text-muted-foreground">({item.uom}, {avail} available)</span> : null}</Label>
            <Input id="w-qty" className="h-12 text-base" type="number" step="0.0001" min="0" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 2" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-reason">Reason <span className="text-destructive">*</span></Label>
            <select id="w-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={sel} aria-label="Reason">
              <option value="">Select a reason…</option>
              {REASONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="w-notes">Notes</Label>
          <Input id="w-notes" className="h-12 text-base" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">Value lost: <b className="tabular-nums">{inr(value)}</b> {item && item.unitCost === 0 ? <span className="text-xs text-muted-foreground">(no batch cost yet)</span> : null}</p>
          <div className="flex items-center gap-3">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button className="h-12 text-base" onClick={submit} disabled={pending}>{pending ? "Saving…" : "Record wastage"}</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
