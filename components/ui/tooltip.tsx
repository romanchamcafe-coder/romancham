"use client";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";

// Lightweight tooltip. Wrapping span receives hover/focus even when the child
// (e.g. a disabled button) does not, so it works for disabled triggers too.
export function Tooltip({ content, children, side = "top", className }: {
  content: React.ReactNode; children: React.ReactNode; side?: Side; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const pos: Record<Side, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open && (
        <span role="tooltip" id={id}
          className={cn("pointer-events-none absolute z-[70] w-max max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md", pos[side])}>
          {content}
        </span>
      )}
    </span>
  );
}
