"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { allocateFifo } from "@/lib/fifo";
import { postStockTransfer } from "@/server/actions/pnc";

const sel = "h-12 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

type Item = { id: string; name: string; uom: string; store: number; display: number; batches: { id: string; code: string; producedOn: string; unitCost: number; onHand: number }[] };

export function TransferForm({ items, repeat }: { items: Item[]; repeat: { id: string; name: string; qty: number }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [id, setId] = useState("");
  const [qty, setQty] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const item = items.find((i) => i.id === id) || null;

  const plan = useMemo(() => {
    if (!item || !Number(qty)) return null;
    return allocateFifo(item.batches, Number(qty));
  }, [item, qty]);

  function run(itemId: string, q: string) {
    setErr(null);
    if (!itemId) { setErr("Select a product"); return; }
    if (!Number(q) || Number(q) <= 0) { setErr("Enter a quantity greater than 0"); return; }
    start(async () => {
      const res = await postStockTransfer({ sales_item_id: itemId, qty: q });
      if (res?.error) setErr(res.error);
      else { toast("Transferred to Display"); setQty(""); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      {repeat.length > 0 && (
        <Card>
          <div className="border-b px-4 py-2 text-sm font-medium">Repeat yesterday&apos;s transfers</div>
          <div className="flex flex-wrap gap-2 p-3">
            {repeat.map((r) => (
              <Button key={r.id} variant="outline" size="sm" disabled={pending} onClick={() => run(r.id, String(r.qty))}>
                {r.name} · {r.qty}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-item">Product</Label>
            <select id="t-item" value={id} onChange={(e) => { setId(e.target.value); setQty(""); }} className={sel} aria-label="Product">
              <option value="">Select a product…</option>
              {items.filter((i) => i.store > 0).map((i) => <option key={i.id} value={i.id}>{i.name} — {i.store} {i.uom} in store</option>)}
            </select>
            {item && <p className="text-xs text-muted-foreground">In store: <b>{item.store} {item.uom}</b> · On display: <b>{item.display} {item.uom}</b></p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-qty">Quantity to move {item ? <span className="text-xs font-normal text-muted-foreground">({item.uom})</span> : null}</Label>
            <Input id="t-qty" className="h-12 text-base" type="number" step="0.0001" min="0" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 10" />
          </div>

          {plan && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="mb-1 font-medium">FIFO allocation</div>
              {plan.allocations.length === 0 ? <p className="text-muted-foreground">No stock available.</p> : plan.allocations.map((a) => (
                <div key={a.batchId} className="flex justify-between"><span className="font-mono text-xs">{a.code}</span><span className="tabular-nums">{a.qty} {item?.uom}</span></div>
              ))}
              {plan.shortfall > 0 && <div className="mt-1"><Badge tone="red">Short by {plan.shortfall} {item?.uom}</Badge></div>}
            </div>
          )}

          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button className="h-12 w-full text-base sm:w-auto" disabled={pending || (plan?.shortfall ?? 0) > 0} onClick={() => run(id, qty)}>{pending ? "Moving…" : "Transfer to Display"}</Button>
        </div>
      </Card>
    </div>
  );
}
