"use client";
import { useId, useState, useRef, useLayoutEffect, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";
const GAP = 8; // distance between trigger and tooltip
const PAD = 8; // min distance from viewport edge
const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

type Rect = { top: number; left: number; bottom: number; right: number; width: number; height: number };

function coordsFor(side: Side, t: Rect, w: number, h: number): { top: number; left: number } {
  switch (side) {
    case "top": return { top: t.top - h - GAP, left: t.left + t.width / 2 - w / 2 };
    case "bottom": return { top: t.bottom + GAP, left: t.left + t.width / 2 - w / 2 };
    case "left": return { top: t.top + t.height / 2 - h / 2, left: t.left - w - GAP };
    case "right": return { top: t.top + t.height / 2 - h / 2, left: t.right + GAP };
  }
}

/**
 * Accessible, viewport-aware tooltip:
 * - Rendered in a portal on <body>, so it is never clipped by overflow ancestors.
 * - Flips to the opposite side and clamps within the viewport when space is tight.
 * - Opens on hover AND keyboard focus; closes on blur, Escape, outside tap or scroll.
 * - Mobile-friendly: tap the trigger to toggle.
 */
export function Tooltip({ content, children, side = "top", className }: {
  content: React.ReactNode; children: React.ReactNode; side?: Side; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const trg = triggerRef.current?.getBoundingClientRect();
    const tip = tipRef.current?.getBoundingClientRect();
    if (!trg || !tip) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const fits = (s: Side) => {
      const c = coordsFor(s, trg, tip.width, tip.height);
      return c.left >= PAD && c.left + tip.width <= vw - PAD && c.top >= PAD && c.top + tip.height <= vh - PAD;
    };
    const order: Side[] = [side, OPPOSITE[side], "top", "bottom", "left", "right"];
    const chosen = order.find(fits) ?? side;
    const c = coordsFor(chosen, trg, tip.width, tip.height);
    setPos({
      top: Math.min(Math.max(PAD, c.top), vh - PAD - tip.height),
      left: Math.min(Math.max(PAD, c.left), vw - PAD - tip.width),
    });
  }, [side]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const reflow = () => place();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDoc = (e: PointerEvent) => {
      if (!triggerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("scroll", reflow, true);
    window.addEventListener("resize", reflow);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDoc);
    return () => {
      window.removeEventListener("scroll", reflow, true);
      window.removeEventListener("resize", reflow);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDoc);
    };
  }, [open, place]);

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {mounted && open && createPortal(
        <div
          ref={tipRef}
          role="tooltip"
          id={id}
          style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          className="pointer-events-none z-[200] w-max max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md"
        >
          {content}
        </div>,
        document.body,
      )}
    </span>
  );
}
