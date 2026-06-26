"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRecipe } from "@/server/actions/recipes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inr } from "@/lib/utils";
import { Trash2 } from "lucide-react";

type Item = { id: string; name: string };
type Line = { component_id: string; qty: string };
type RecipeRow = { id: string; components: { component_id: string; qty: number }[] };

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function RecipeBuilder({ salesItems, purchaseItems, costMap, recipes }: {
  salesItems: Item[]; purchaseItems: Item[]; costMap: Record<string, number>; recipes: RecipeRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [salesId, setSalesId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ component_id: "", qty: "" }]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function pickSales(id: string) {
    setSalesId(id); setMsg(null); setErr(null);
    const r = recipes.find((x) => x.id === id);
    setLines(r && r.components.length ? r.components.map((c) => ({ component_id: c.component_id, qty: String(c.qty) })) : [{ component_id: "", qty: "" }]);
  }
  const upd = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...p } : l));
  const cost = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (costMap[l.component_id] || 0), 0);

  function save() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await saveRecipe(salesId, lines.map((l) => ({ component_id: l.component_id, qty: Number(l.qty) })));
      if (res?.error) setErr(res.error); else { setMsg("Recipe saved."); router.refresh(); }
    });
  }

  return (
    <Card><CardContent className="space-y-4 pt-6">
      <div className="max-w-sm space-y-1.5">
        <Label>Sales item (the product you sell)</Label>
        <select value={salesId} onChange={(e) => pickSales(e.target.value)} className={sel}>
          <option value="">Select a sales item…</option>
          {salesItems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {salesId && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr><th className="px-2 py-2 font-medium">Component (purchase item)</th><th className="w-28 px-2 py-2 font-medium">Qty / portion</th><th className="w-28 px-2 py-2 text-right font-medium">Cost</th><th className="w-8"></th></tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-1.5">
                      <select value={l.component_id} onChange={(e) => upd(i, { component_id: e.target.value })} className={sel + " min-w-44"}>
                        <option value="">Select…</option>
                        {purchaseItems.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="p-1.5"><Input className="h-9 w-24" type="number" step="0.0001" value={l.qty} onChange={(e) => upd(i, { qty: e.target.value })} /></td>
                    <td className="p-1.5 text-right tabular-nums">{inr((Number(l.qty) || 0) * (costMap[l.component_id] || 0))}</td>
                    <td className="p-1.5 text-center">{lines.length > 1 && <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-2"><Button variant="outline" size="sm" type="button" onClick={() => setLines((ls) => [...ls, { component_id: "", qty: "" }])}>+ Add component</Button></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Recipe cost / portion: <span className="font-semibold text-foreground">{inr(cost)}</span></div>
            <div className="flex items-center gap-3">
              {msg && <span className="text-sm text-green-600">{msg}</span>}
              {err && <span className="text-sm text-destructive">{err}</span>}
              <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save Recipe"}</Button>
            </div>
          </div>
        </>
      )}
    </CardContent></Card>
  );
}
