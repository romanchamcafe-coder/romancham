"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { RANGE_LABELS, RANGE_ORDER, type RangeKey } from "@/lib/date-ranges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays } from "lucide-react";

export function DateRangePicker({ current, from, to }: { current: RangeKey; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(current === "custom");
  const [cFrom, setCFrom] = useState(from);
  const [cTo, setCTo] = useState(to);

  function apply(key: RangeKey) {
    if (key === "custom") { setShowCustom(true); return; }
    router.push(`${pathname}?range=${key}`);
    setOpen(false);
  }
  function applyCustom() {
    router.push(`${pathname}?range=custom&from=${cFrom}&to=${cTo}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <CalendarDays className="h-4 w-4" /> {RANGE_LABELS[current]}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border bg-card p-1.5 shadow-lg" role="menu">
            {RANGE_ORDER.map((k) => (
              <button key={k} role="menuitemradio" aria-checked={current === k} onClick={() => apply(k)}
                className={"flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm " + (current === k ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>
                {RANGE_LABELS[k]}
              </button>
            ))}
            {showCustom && (
              <div className="mt-1 space-y-2 border-t p-2">
                <div className="space-y-1"><Label htmlFor="dr-from" className="text-xs">From</Label><Input id="dr-from" type="date" className="h-8" value={cFrom} onChange={(e) => setCFrom(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="dr-to" className="text-xs">To</Label><Input id="dr-to" type="date" className="h-8" value={cTo} onChange={(e) => setCTo(e.target.value)} /></div>
                <Button size="sm" className="w-full" onClick={applyCustom}>Apply custom</Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
