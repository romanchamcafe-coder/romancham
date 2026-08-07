"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIndent } from "@/server/actions/requests";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemsPicker, type PickRow } from "@/components/ops/items-picker";
import type { ReqItem } from "@/server/queries/requests";

export function IndentForm({ items }: { items: ReqItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<PickRow[]>([{ ingredient_id: "", qty: "" }]);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    setErr(null);
    const clean = rows.filter((r) => r.ingredient_id && Number(r.qty) > 0);
    if (clean.length === 0) { setErr("Add at least one item with a quantity"); return; }
    start(async () => {
      const res = await createIndent(clean, note);
      if (res?.error) { setErr(res.error); return; }
      toast("Indent sent");
      setRows([{ ingredient_id: "", qty: "" }]); setNote("");
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-3 text-sm font-semibold">New indent</p>
      <ItemsPicker items={items} rows={rows} setRows={setRows} />
      <div className="mt-3 space-y-1.5">
        <Label>Note <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. needed for tomorrow" className="h-11" />
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <Button className="mt-3 h-12 w-full text-base" onClick={submit} disabled={pending}>{pending ? "Sending…" : "Send indent"}</Button>
    </div>
  );
}
