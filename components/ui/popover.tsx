"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Popover({ trigger, children, align = "end", className }: {
  trigger: (o: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="relative inline-block" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={cn("absolute z-[65] mt-1 rounded-md border bg-card p-2 shadow-lg", align === "end" ? "right-0" : "left-0", className)}>
          {children}
        </div>
      )}
    </div>
  );
}
