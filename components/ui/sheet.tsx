"use client";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

// Minimal slide-out drawer (Sheet). Renders an overlay + a panel from a side.
export function Sheet({ open, onClose, side = "left", children, className, label }: {
  open: boolean; onClose: () => void; side?: "left" | "right";
  children: React.ReactNode; className?: string; label?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn("absolute top-0 h-full w-72 max-w-[80%] overflow-y-auto bg-card shadow-xl",
        side === "left" ? "left-0" : "right-0", className)}>
        {children}
      </div>
    </div>
  );
}
