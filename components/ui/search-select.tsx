"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check, Plus } from "lucide-react";

export type SearchOption = { value: string; label: string };

const byName = (a: SearchOption, b: SearchOption) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true });

/**
 * Dropdown with a type-to-search box. Options are always shown A→Z.
 * - allowCustom: lets the user use the typed text as a new value
 *   (e.g. a new category / packaging name).
 */
export function SearchSelect({
  value: controlled, onChange: onChangeProp, options, placeholder = "Select…", ariaLabel, allowCustom = false,
  emptyLabel, className = "", sort = true, name, defaultValue = "", id,
}: {
  /** Controlled value. Omit (and pass `name`) to use inside a plain <form>. */
  value?: string;
  onChange?: (v: string) => void;
  name?: string;
  defaultValue?: string;
  id?: string;
  options: SearchOption[];
  placeholder?: string;
  ariaLabel?: string;
  allowCustom?: boolean;
  /** Label for a "clear" option at the top (e.g. "Select vendor…"). Omit to hide. */
  emptyLabel?: string;
  className?: string;
  sort?: boolean;
}) {
  const [inner, setInner] = useState(defaultValue);
  const value = controlled ?? inner;
  const onChange = (v: string) => { if (controlled === undefined) setInner(v); onChangeProp?.(v); };
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);

  // Popup is rendered in a portal (fixed position) so tables / cards with
  // overflow never clip it.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btn.current?.getBoundingClientRect(); if (!r) return;
      const width = Math.max(r.width, 224);
      const left = Math.min(r.left, window.innerWidth - width - 8);
      const up = window.innerHeight - r.bottom < 320 && r.top > 320;
      setPos({ top: up ? r.top - 4 : r.bottom + 4, left: Math.max(8, left), width, up });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  const sorted = useMemo(() => (sort ? [...options].sort(byName) : options), [options, sort]);
  const selected = options.find((o) => o.value === value);
  const shown = selected?.label ?? (allowCustom && value ? value : "");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sorted;
    const starts: SearchOption[] = [], contains: SearchOption[] = [];
    for (const o of sorted) {
      const l = o.label.toLowerCase();
      if (l.startsWith(s) || l.split(/\s+/).some((w) => w.startsWith(s))) starts.push(o);
      else if (l.includes(s)) contains.push(o);
    }
    return [...starts, ...contains];
  }, [q, sorted]);

  const typed = q.trim();
  const canAdd = allowCustom && typed !== "" && !options.some((o) => o.label.toLowerCase() === typed.toLowerCase());
  const rows = (emptyLabel ? 1 : 0) + filtered.length + (canAdd ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (wrap.current?.contains(t) || pop.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, [open]);

  useEffect(() => { if (open) { setQ(""); setHi(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);
  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-idx="${hi}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  function pick(v: string) { onChange(v); setOpen(false); }

  function pickIndex(i: number) {
    let k = i;
    if (emptyLabel) { if (k === 0) return pick(""); k -= 1; }
    if (k < filtered.length) return pick(filtered[k].value);
    if (canAdd) pick(typed);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, rows - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (rows > 0) pickIndex(hi); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }

  let idx = 0;
  const item = (key: string, label: React.ReactNode, onClick: () => void, active: boolean, muted = false) => {
    const my = idx++;
    return (
      <li key={key} data-idx={my} role="option" aria-selected={active}
        onMouseDown={(e) => { e.preventDefault(); onClick(); }}
        onMouseEnter={() => setHi(my)}
        className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${hi === my ? "bg-primary/15 text-foreground" : ""} ${muted ? "text-muted-foreground" : ""}`}>
        <Check className={`h-3.5 w-3.5 shrink-0 ${active ? "opacity-100 text-primary" : "opacity-0"}`} />
        <span className="truncate">{label}</span>
      </li>
    );
  };

  return (
    <div ref={wrap} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <button ref={btn} type="button" id={id} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "Enter" || /^[\w ]$/.test(e.key))) { e.preventDefault(); setOpen(true); } }}
        className="flex h-9 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className={`truncate ${shown ? "" : "text-muted-foreground"}`}>{shown || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={pop} className="fixed z-[200] rounded-md border bg-card p-1 text-card-foreground shadow-lg"
          style={{ left: pos.left, width: pos.width, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}>
          <div className="flex items-center gap-1.5 border-b px-2 pb-1">
            <Search className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
              placeholder="Type to search…" aria-label={`Search ${ariaLabel ?? ""}`.trim()}
              className="h-8 w-full bg-transparent text-sm outline-none" />
          </div>
          <ul ref={list} role="listbox" className="mt-1 max-h-64 overflow-y-auto">
            {emptyLabel && item("__empty", emptyLabel, () => pick(""), value === "", true)}
            {filtered.map((o) => item(o.value, o.label, () => pick(o.value), o.value === value))}
            {canAdd && (() => {
              const my = idx++;
              return (
                <li key="__add" data-idx={my} onMouseDown={(e) => { e.preventDefault(); pick(typed); }} onMouseEnter={() => setHi(my)}
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-primary ${hi === my ? "bg-primary/15" : ""}`}>
                  <Plus className="h-3.5 w-3.5 shrink-0" /> Use &quot;{typed}&quot;
                </li>
              );
            })()}
            {filtered.length === 0 && !canAdd && <li className="px-2 py-2 text-sm text-muted-foreground">No match for &quot;{typed}&quot;</li>}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
