"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitChecklist } from "@/server/actions/operations";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft } from "lucide-react";
import type { ChecklistDef } from "@/lib/ops/checklists";

type ItemState = { key: string; label: string; critical?: boolean; value?: string; checked: boolean };
type Existing = { items?: ItemState[]; notes?: string | null } | null;

export function ChecklistRunner({ def, existing }: { def: ChecklistDef; existing: Existing }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const init = useMemo<ItemState[]>(() => {
    const prev = new Map((existing?.items ?? []).map((i) => [i.key, i]));
    return def.items.map((it) => ({
      key: it.key, label: it.label, critical: it.critical,
      checked: prev.get(it.key)?.checked ?? false,
      value: prev.get(it.key)?.value ?? "",
    }));
  }, [def, existing]);
  const [items, setItems] = useState<ItemState[]>(init);
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const done = items.filter((i) => i.checked).length;
  const total = items.length;
  const score = total ? Math.round((done / total) * 100) : 0;

  const toggle = (key: string) => setItems((s) => s.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i)));
  const setValue = (key: string, v: string) => setItems((s) => s.map((i) => (i.key === key ? { ...i, value: v } : i)));

  const def_items = def.items;
  const save = () => {
    start(async () => {
      const res = await submitChecklist(def.type, items, notes);
      if (res?.error) toast(res.error, "error");
      else { toast(res.message || "Checklist saved"); router.push("/operations"); router.refresh(); }
    });
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-24">
      <Link href="/operations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Operations
      </Link>
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold">{def.title}</h1>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{score}%</p>
          <p className="text-xs text-muted-foreground">{done}/{total} done</p>
        </div>
      </div>

      <div className="space-y-2">
        {def_items.map((it, idx) => {
          const st = items[idx];
          return (
            <div key={it.key} className={`rounded-xl border p-1 ${st.checked ? "border-green-300 bg-green-50" : "bg-card"}`}>
              <button
                type="button"
                onClick={() => toggle(it.key)}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left active:scale-[.99]"
                aria-pressed={st.checked}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${st.checked ? "border-green-600 bg-green-600 text-white" : "border-muted-foreground/30"}`}>
                  {st.checked && <Check className="h-5 w-5" />}
                </span>
                <span className="flex-1 text-[15px] leading-snug">
                  {it.label}
                  {it.critical && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">critical</span>}
                </span>
              </button>
              {it.value === "temp" && (
                <div className="flex items-center gap-2 px-3 pb-3">
                  <label className="text-xs text-muted-foreground">Temp</label>
                  <input
                    type="number" inputMode="decimal" step="0.1" value={st.value}
                    onChange={(e) => setValue(it.key, e.target.value)}
                    placeholder="°C"
                    className="h-10 w-24 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">°C</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder="Anything to flag?"
          className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {/* sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto max-w-lg">
          <Button className="h-12 w-full text-base" onClick={save} disabled={pending}>
            {pending ? "Saving…" : `Save checklist · ${score}%`}
          </Button>
        </div>
      </div>
    </div>
  );
}
