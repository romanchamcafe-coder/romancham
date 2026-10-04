"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CostBook, convertQty, normaliseLines, unitInfo, foodCostPct, type Breakdown, type CostUnit, type RecipeLine } from "@/lib/costing";
import type { CostData } from "@/server/queries/costing";
import type { DishPrice } from "@/server/queries/recipes";
import { saveRecipeV2, createPrep, clearRecipe } from "@/server/actions/recipes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchSelect } from "@/components/ui/search-select";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Trash2, ChevronRight, Plus, FlaskConical, UtensilsCrossed, AlertTriangle } from "lucide-react";

type Tab = "dish" | "prep";
type LineKind = "raw" | "prep";
type EditLine = { kind: LineKind; componentId: string; qty: string; unitId: string };
type Editor = { yieldQty: string; notes: string; shelf: string; storage: string; lines: EditLine[] };

const rs = (n: number) => "₹" + (Math.round(n * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rate = (n: number) => "₹" + (n >= 10 ? n.toFixed(2) : n >= 1 ? n.toFixed(3) : n.toFixed(4));
const qfmt = (n: number) => String(Math.round(n * 1000) / 1000);
const blankLine = (kind: LineKind = "raw"): EditLine => ({ kind, componentId: "", qty: "", unitId: "" });

export function RecipeWorkspace({ data, prices, categories, initialTab }: {
  data: CostData; prices: Record<string, DishPrice>; categories: { id: string; name: string }[]; initialTab: Tab;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selected, setSelected] = useState("");
  const [ed, setEd] = useState<Editor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [newPrep, setNewPrep] = useState<{ name: string; unitId: string; categoryId: string } | null>(null);

  const units = data.units;
  const unitBy = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const itemBy = useMemo(() => new Map(data.items.map((i) => [i.id, i])), [data.items]);
  const book = useMemo(() => new CostBook(data), [data]);
  const active = data.items.filter((i) => i.isActive);
  const dishes = active.filter((i) => i.materialType === "sales" || i.materialType === "both").sort((a, b) => a.name.localeCompare(b.name));
  const preps = active.filter((i) => i.kind === "prep").sort((a, b) => a.name.localeCompare(b.name));
  const raws = active.filter((i) => i.materialType === "purchase" || i.materialType === "both");
  const usedIn = (id: string) => data.lines.filter((l) => l.componentId === id).map((l) => itemBy.get(l.parentId)?.name).filter(Boolean) as string[];
  const g = (id: string | null | undefined) => (id ? unitBy.get(id) : undefined);

  // ---- load a recipe into the editor ----
  function load(id: string) {
    setSelected(id); setDirty(false); setNewPrep(null);
    if (!id) { setEd(null); return; }
    const h = book.header(id);
    const y = h?.yieldQty ?? 1;
    const lines = book.lines(id).map((l): EditLine => {
      const c = itemBy.get(l.componentId);
      const entryUnit = g(l.entryUnitId) ?? g(c?.baseUnitId);
      const qty = l.entryQty ?? convertQty(l.qty * y, g(c?.baseUnitId), entryUnit) ?? l.qty * y;
      return { kind: c?.kind === "prep" ? "prep" : "raw", componentId: l.componentId, qty: qfmt(qty), unitId: entryUnit?.id ?? "" };
    });
    setEd({ yieldQty: h ? qfmt(y) : tab === "dish" ? "1" : "", notes: h?.notes ?? "", shelf: h?.shelfLifeDays ? String(h.shelfLifeDays) : "", storage: "", lines: lines.length ? lines : [blankLine()] });
  }
  useEffect(() => { if (selected && !ed && itemBy.has(selected)) load(selected); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchTab(t: Tab) {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setTab(t); setSelected(""); setEd(null); setDirty(false); setNewPrep(null);
  }
  const updEd = (p: Partial<Editor>) => { setEd((e) => (e ? { ...e, ...p } : e)); setDirty(true); };
  const updLine = (i: number, p: Partial<EditLine>) => { setEd((e) => (e ? { ...e, lines: e.lines.map((l, k) => (k === i ? { ...l, ...p } : l)) } : e)); setDirty(true); };

  // ---- live what-if book with the editor's (unsaved) lines ----
  const yieldNum = Number(ed?.yieldQty) || 0;
  const live = useMemo(() => {
    if (!ed || !selected) return null;
    const entries = ed.lines.map((l) => ({ componentId: l.componentId, entryQty: Number(l.qty), entryUnitId: l.unitId || null }));
    const n = normaliseLines(selected, yieldNum > 0 ? yieldNum : 1, entries, itemBy, unitBy);
    const otherLines: RecipeLine[] = data.lines.filter((l) => l.parentId !== selected);
    const headers = [...data.headers.filter((h) => h.itemId !== selected), { itemId: selected, type: tab, yieldQty: yieldNum > 0 ? yieldNum : 1 }];
    return { book: new CostBook({ items: data.items, units, headers, lines: [...otherLines, ...n.lines] }), errors: n.errors };
  }, [ed, selected, yieldNum, data, tab, itemBy, unitBy, units]);

  const selItem = itemBy.get(selected);
  const selUnit = g(selItem?.baseUnitId);
  const res = live && selected ? live.book.result(selected) : null;
  const lineErr = (i: number) => live?.errors.find((e) => e.index === i)?.message;

  // input total in the prep's unit (only when every line converts)
  let inputTotal: number | null = 0;
  if (ed) for (const l of ed.lines) {
    if (!l.componentId || !(Number(l.qty) > 0)) continue;
    const v = convertQty(Number(l.qty), g(l.unitId) ?? g(itemBy.get(l.componentId)?.baseUnitId), selUnit);
    if (v == null) { inputTotal = null; break; }
    inputTotal += v;
  }

  const price = prices[selected];
  const priceEx = price && price.dinePrice > 0 ? price.dinePrice / (1 + price.gstPct / 100) : 0;
  const portionCost = res ? res.unitCost : 0;
  const fcp = tab === "dish" ? foodCostPct(portionCost, priceEx) : null;

  function save() {
    if (!ed || !selected) return;
    start(async () => {
      const r = await saveRecipeV2({
        itemId: selected, type: tab, yieldQty: Number(ed.yieldQty), notes: ed.notes, shelfLifeDays: Number(ed.shelf) || null, storage: ed.storage,
        lines: ed.lines.filter((l) => l.componentId).map((l) => ({ componentId: l.componentId, entryQty: Number(l.qty), entryUnitId: l.unitId || null })),
      });
      if (r.error) toast(r.error, "error");
      else { toast(tab === "prep" ? "Prep recipe saved — every dish using it is updated" : "Dish recipe saved"); setDirty(false); router.refresh(); }
    });
  }
  function clear() {
    if (!selected || !confirm("Remove this recipe's ingredient list?")) return;
    start(async () => {
      const r = await clearRecipe(selected);
      if (r.error) toast(r.error, "error"); else { toast("Recipe cleared"); setEd(null); setSelected(""); router.refresh(); }
    });
  }
  function addPrep() {
    if (!newPrep) return;
    start(async () => {
      const r = await createPrep(newPrep);
      if (r.error) { toast(r.error, "error"); return; }
      toast(`Prep "${newPrep.name}" created — now add its ingredients`);
      setNewPrep(null); setSelected(r.id!); setEd({ yieldQty: "", notes: "", shelf: "", storage: "", lines: [blankLine()] }); setDirty(true);
      router.refresh();
    });
  }

  const compatUnits = (componentId: string): CostUnit[] => {
    const base = g(itemBy.get(componentId)?.baseUnitId);
    if (!base) return units;
    const fam = unitInfo(base).family;
    return units.filter((u) => unitInfo(u).family === fam);
  };
  const defaultUnit = (componentId: string) => itemBy.get(componentId)?.baseUnitId ?? "";

  // ---------------- render ----------------
  const list = tab === "dish" ? dishes : preps;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => switchTab("dish")} className={cn("flex items-center gap-2 rounded-lg border px-4 py-2 text-sm", tab === "dish" ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted")}>
          <UtensilsCrossed className="h-4 w-4" /> Final dishes <span className="text-xs text-muted-foreground">({dishes.length})</span>
        </button>
        <button type="button" onClick={() => switchTab("prep")} className={cn("flex items-center gap-2 rounded-lg border px-4 py-2 text-sm", tab === "prep" ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted")}>
          <FlaskConical className="h-4 w-4" /> Prep / Components <span className="text-xs text-muted-foreground">({preps.length})</span>
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {tab === "prep"
          ? <>A <b>prep</b> is made in batches (e.g. Whipped Yoghurt, Granola, Compote). Enter what goes in and the <b>final weight you get</b> — Romancham works out the cost per gram. Use it in any dish; price changes flow through automatically.</>
          : <>A <b>final dish</b> is what you sell. Add raw ingredients and/or preps per portion — food cost and food cost % are calculated live.</>}
      </p>

      <Card><CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1 space-y-1.5">
            <Label>{tab === "dish" ? "Dish (sales item)" : "Prep / Component"}</Label>
            <SearchSelect options={list.map((i) => ({ value: i.id, label: `${i.name}${book.lines(i.id).length ? "" : "  · no recipe yet"}` }))}
              value={selected} onChange={(v) => { if (dirty && !confirm("Discard unsaved changes?")) return; load(v); }}
              placeholder={tab === "dish" ? "Select a dish…" : "Select a prep…"} />
          </div>
          {tab === "prep" && !newPrep && <Button variant="outline" onClick={() => setNewPrep({ name: "", unitId: units.find((u) => /^(g|gm|gms)$/i.test(u.abbr))?.id ?? "", categoryId: "" })}><Plus className="h-4 w-4" /> New prep</Button>}
        </div>

        {newPrep && (
          <div className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-4">
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Prep name</Label><Input value={newPrep.name} onChange={(e) => setNewPrep({ ...newPrep, name: e.target.value })} placeholder="e.g. Whipped Yoghurt" autoFocus /></div>
            <div className="space-y-1"><Label className="text-xs">Measured in</Label>
              <select value={newPrep.unitId} onChange={(e) => setNewPrep({ ...newPrep, unitId: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Select unit…</option>{units.map((u) => <option key={u.id} value={u.id}>{u.abbr}{u.name && u.name !== u.abbr ? ` — ${u.name}` : ""}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Category (optional)</Label><SearchSelect options={categories.map((c) => ({ value: c.id, label: c.name }))} value={newPrep.categoryId} onChange={(v) => setNewPrep({ ...newPrep, categoryId: v })} placeholder="—" emptyLabel="—" /></div>
            <div className="flex gap-2 sm:col-span-4"><Button size="sm" onClick={addPrep} disabled={pending}>Create prep</Button><Button size="sm" variant="outline" onClick={() => setNewPrep(null)}>Cancel</Button></div>
          </div>
        )}

        {ed && selItem && (
          <>
            {tab === "prep" && (
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Total going in</Label>
                  <div className="flex h-10 items-center text-sm font-medium">{inputTotal != null && inputTotal > 0 ? `${qfmt(inputTotal)} ${selUnit?.abbr ?? ""}` : "—"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-primary">FINAL yield (what you actually get) *</Label>
                  <div className="flex items-center gap-2"><Input type="number" min="0" step="0.01" value={ed.yieldQty} onChange={(e) => updEd({ yieldQty: e.target.value })} placeholder={inputTotal ? qfmt(inputTotal) : "e.g. 520"} className="border-primary" /><span className="text-sm">{selUnit?.abbr}</span></div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cooking / process loss</Label>
                  <div className="flex h-10 items-center text-sm">{inputTotal && yieldNum > 0 ? `${qfmt(((inputTotal - yieldNum) / inputTotal) * 100)} %` : "—"}</div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Shelf life (days)</Label><Input type="number" min="0" value={ed.shelf} onChange={(e) => updEd({ shelf: e.target.value })} placeholder="optional" /></div>
                <p className="text-xs text-muted-foreground sm:col-span-4">Weigh the finished batch. Cost per {selUnit?.abbr ?? "unit"} = batch cost ÷ <b>final yield</b> (not the total going in) — so water loss while cooking is costed correctly.</p>
              </div>
            )}
            {tab === "dish" && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Label className="text-xs">Quantities below are for</Label>
                <Input type="number" min="1" step="1" value={ed.yieldQty} onChange={(e) => updEd({ yieldQty: e.target.value })} className="h-9 w-20" />
                <span className="text-xs text-muted-foreground">portion(s) — usually 1</span>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs">
                  <tr><th className="px-2 py-2">Type</th><th className="px-2 py-2">Item</th><th className="w-24 px-2 py-2">Qty</th><th className="w-24 px-2 py-2">Unit</th><th className="px-2 py-2 text-right">Unit cost</th><th className="px-2 py-2 text-right">Line cost</th><th className="w-8" /></tr>
                </thead>
                <tbody>
                  {ed.lines.map((l, i) => {
                    const c = itemBy.get(l.componentId);
                    const cu = g(c?.baseUnitId);
                    const uc = l.componentId && live ? live.book.unitCost(l.componentId) : 0;
                    const baseQ = l.componentId ? convertQty(Number(l.qty) || 0, g(l.unitId) ?? cu, cu) : null;
                    const err = lineErr(i);
                    const opts = (l.kind === "prep" ? preps.filter((p) => p.id !== selected) : raws).map((x) => ({ value: x.id, label: x.name }));
                    const noPrice = c && c.kind === "raw" && !(c.purchaseUnitCost && c.purchaseUnitCost > 0);
                    return (
                      <tr key={i} className="border-b align-top last:border-0">
                        <td className="p-1.5">
                          <div className="inline-flex overflow-hidden rounded-md border text-xs">
                            {(["raw", "prep"] as LineKind[]).map((k) => (
                              <button key={k} type="button" onClick={() => updLine(i, { kind: k, componentId: "", unitId: "" })}
                                className={cn("px-2 py-1.5", l.kind === k ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{k === "raw" ? "Raw" : "Prep"}</button>
                            ))}
                          </div>
                        </td>
                        <td className="p-1.5">
                          <SearchSelect className="min-w-52" options={opts} value={l.componentId} onChange={(v) => updLine(i, { componentId: v, unitId: defaultUnit(v) })} placeholder={l.kind === "prep" ? "Select prep…" : "Select ingredient…"} />
                          {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
                          {noPrice && <p className="mt-1 flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3 w-3" /> No purchase price yet — record a purchase for this item.</p>}
                          {c && c.kind === "raw" && c.yieldPct != null && c.yieldPct < 100 && <p className="mt-1 text-xs text-muted-foreground">{c.yieldPct}% usable — cost adjusted</p>}
                        </td>
                        <td className="p-1.5"><Input className="h-9" type="number" min="0" step="0.001" value={l.qty} onChange={(e) => updLine(i, { qty: e.target.value })} /></td>
                        <td className="p-1.5">
                          <select value={l.unitId} onChange={(e) => updLine(i, { unitId: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-1 text-sm" disabled={!l.componentId}>
                            {(l.componentId ? compatUnits(l.componentId) : units).map((u) => <option key={u.id} value={u.id}>{u.abbr}</option>)}
                          </select>
                        </td>
                        <td className="p-1.5 text-right tabular-nums text-muted-foreground">{l.componentId ? `${rate(uc)}/${cu?.abbr ?? "unit"}` : "—"}</td>
                        <td className="p-1.5 text-right font-medium tabular-nums">{baseQ != null && l.componentId ? rs(baseQ * uc) : "—"}</td>
                        <td className="p-1.5 text-center">{ed.lines.length > 1 && <button type="button" onClick={() => { setEd({ ...ed, lines: ed.lines.filter((_, k) => k !== i) }); setDirty(true); }} className="text-muted-foreground hover:text-destructive" aria-label="Remove line"><Trash2 className="h-4 w-4" /></button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex gap-2 p-2">
                <Button variant="outline" size="sm" type="button" onClick={() => { setEd({ ...ed, lines: [...ed.lines, blankLine("raw")] }); setDirty(true); }}>+ Raw ingredient</Button>
                <Button variant="outline" size="sm" type="button" onClick={() => { setEd({ ...ed, lines: [...ed.lines, blankLine("prep")] }); setDirty(true); }}>+ Prep / Component</Button>
              </div>
            </div>

            {/* Totals */}
            {res && (
              <div className="grid gap-3 sm:grid-cols-3">
                {tab === "prep" ? <>
                  <Stat label="Total batch cost" value={rs(res.batchCost)} />
                  <Stat label="Final yield" value={yieldNum > 0 ? `${qfmt(yieldNum)} ${selUnit?.abbr ?? ""}` : "enter yield"} warn={!(yieldNum > 0)} />
                  <Stat label={`Cost per ${selUnit?.abbr ?? "unit"}`} value={yieldNum > 0 ? `${rate(res.unitCost)}${unitInfo(selUnit).family !== "count" && unitInfo(selUnit).factor === 1 ? `  ·  ${rs(res.unitCost * 1000)}/${unitInfo(selUnit).family === "volume" ? "L" : "kg"}` : ""}` : "—"} strong />
                </> : <>
                  <Stat label="Food cost per portion" value={rs(portionCost)} strong />
                  <Stat label="Selling price (dine-in, ex-GST)" value={priceEx ? rs(priceEx) : "set in Menu Engineering"} warn={!priceEx} />
                  <Stat label="Food cost %" value={fcp != null ? `${fcp.toFixed(1)} %` : "—"} tone={fcp == null ? undefined : fcp <= 30 ? "good" : fcp <= 38 ? "ok" : "bad"} />
                </>}
              </div>
            )}

            {/* Traceability */}
            {res && live && live.book.lines(selected).length > 0 && (
              <div className="rounded-lg border">
                <div className="border-b bg-muted/50 px-3 py-2 text-sm font-medium">Why it costs this — tap a prep to see inside</div>
                <div className="p-2 text-sm">{live.book.breakdown(selected).map((b, k) => <Tree key={k} b={b} />)}</div>
              </div>
            )}

            {tab === "prep" && (
              <div className="space-y-1"><Label className="text-xs">Method / notes (optional)</Label>
                <textarea value={ed.notes} onChange={(e) => updEd({ notes: e.target.value })} rows={2} className="w-full rounded-md border border-input bg-background p-2 text-sm" placeholder="e.g. Whip cream to soft peaks, fold into yoghurt, sweeten with honey. Store chilled." /></div>
            )}
            {tab === "prep" && usedIn(selected).length > 0 && <p className="text-xs text-muted-foreground">Used in: {usedIn(selected).join(", ")}</p>}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {book.lines(selected).length > 0 && <Button variant="outline" onClick={clear} disabled={pending}>Clear recipe</Button>}
              <Button onClick={save} disabled={pending}>{pending ? "Saving…" : dirty ? "Save recipe •" : "Save recipe"}</Button>
            </div>
          </>
        )}
      </CardContent></Card>

      {/* Overview list */}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            {tab === "dish"
              ? <tr><th className="p-2">Dish</th><th className="p-2">Made of</th><th className="p-2 text-right">Food cost</th><th className="p-2 text-right">Price (ex-GST)</th><th className="p-2 text-right">Food cost %</th></tr>
              : <tr><th className="p-2">Prep</th><th className="p-2 text-right">Final yield</th><th className="p-2 text-right">Batch cost</th><th className="p-2 text-right">Cost / unit</th><th className="p-2">Used in</th></tr>}
          </thead>
          <tbody>
            {list.map((i) => {
              const r = book.result(i.id);
              const u = g(i.baseUnitId)?.abbr ?? "";
              if (tab === "dish") {
                const p = prices[i.id]; const ex = p && p.dinePrice > 0 ? p.dinePrice / (1 + p.gstPct / 100) : 0;
                const pct = r.hasRecipe ? foodCostPct(r.unitCost, ex) : null;
                return (
                  <tr key={i.id} onClick={() => { if (!dirty || confirm("Discard unsaved changes?")) load(i.id); }} className={cn("cursor-pointer border-b hover:bg-muted/40", selected === i.id && "bg-primary/5")}>
                    <td className="p-2 font-medium">{i.name}</td>
                    <td className="p-2 text-xs text-muted-foreground">{r.hasRecipe ? book.lines(i.id).map((l) => itemBy.get(l.componentId)?.name).join(", ") : "— no recipe yet —"}</td>
                    <td className="p-2 text-right tabular-nums">{r.hasRecipe ? rs(r.unitCost) : "—"}</td>
                    <td className="p-2 text-right tabular-nums">{ex ? rs(ex) : "—"}</td>
                    <td className="p-2 text-right">{pct != null ? <Badge tone={pct <= 30 ? "green" : pct <= 38 ? "amber" : "red"}>{pct.toFixed(1)}%</Badge> : "—"}</td>
                  </tr>
                );
              }
              const uses = usedIn(i.id);
              return (
                <tr key={i.id} onClick={() => { if (!dirty || confirm("Discard unsaved changes?")) load(i.id); }} className={cn("cursor-pointer border-b hover:bg-muted/40", selected === i.id && "bg-primary/5")}>
                  <td className="p-2 font-medium">{i.name}</td>
                  <td className="p-2 text-right tabular-nums">{r.hasRecipe ? `${qfmt(r.yieldQty)} ${u}` : "—"}</td>
                  <td className="p-2 text-right tabular-nums">{r.hasRecipe ? rs(r.batchCost) : "—"}</td>
                  <td className="p-2 text-right tabular-nums">{r.hasRecipe ? `${rate(r.unitCost)}/${u}` : "—"}</td>
                  <td className="p-2 text-xs text-muted-foreground">{uses.length ? uses.join(", ") : "—"}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{tab === "dish" ? "No sales items yet — add them in Ingredients (type Sales)." : "No preps yet — click New prep."}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value, strong, warn, tone }: { label: string; value: string; strong?: boolean; warn?: boolean; tone?: "good" | "ok" | "bad" }) {
  return (
    <div className={cn("rounded-lg border p-3", strong && "border-primary/50 bg-primary/5")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums", warn && "text-sm font-medium text-amber-600", tone === "good" && "text-green-600", tone === "ok" && "text-amber-600", tone === "bad" && "text-red-600")}>{value}</p>
    </div>
  );
}

function Tree({ b, depth = 0 }: { b: Breakdown; depth?: number }) {
  const [open, setOpen] = useState(false);
  const kids = b.children && b.children.length > 0;
  return (
    <div>
      <button type="button" disabled={!kids} onClick={() => setOpen((o) => !o)}
        className={cn("flex w-full items-center gap-2 rounded px-2 py-1 text-left", kids && "hover:bg-muted")} style={{ paddingLeft: 8 + depth * 18 }}>
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !kids && "opacity-0", open && "rotate-90")} />
        <span className={cn("flex-1", depth === 0 && "font-medium")}>{b.name} {b.kind === "prep" && <Badge tone="amber" className="ml-1">prep</Badge>}</span>
        <span className="w-28 text-right tabular-nums text-muted-foreground">{qfmt(b.qty)} {b.unitAbbr}</span>
        <span className="w-32 text-right tabular-nums text-muted-foreground">× {rate(b.unitCost)}/{b.baseUnitAbbr}</span>
        <span className="w-24 text-right font-medium tabular-nums">{rs(b.lineCost)}</span>
      </button>
      {open && kids && b.children!.map((c, k) => <Tree key={k} b={c} depth={depth + 1} />)}
    </div>
  );
}
