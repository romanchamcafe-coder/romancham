"use client";
import { useState } from "react";
import { Input } from "./input";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/**
 * A native dropdown to pick from a list, with an "Other / type new" escape that
 * switches to a free-text input. Native <select> opens the phone's picker, so it
 * works reliably on mobile (unlike <datalist>).
 */
export function SelectOrType({
  value, onChange, options, placeholder = "Select…", ariaLabel, otherLabel = "➕ Other / type new",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  ariaLabel?: string;
  otherLabel?: string;
}) {
  const inList = options.includes(value);
  const [custom, setCustom] = useState(false);
  const showInput = custom || (!inList && value !== "");

  if (showInput) {
    return (
      <div className="flex gap-1">
        <Input className="h-9 w-full" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={ariaLabel} autoFocus />
        {options.length > 0 && (
          <button type="button" onClick={() => { setCustom(false); onChange(""); }} title="Choose from list"
            className="shrink-0 rounded-md border px-2 text-xs text-muted-foreground hover:bg-muted" aria-label="Choose from list">
            ☰
          </button>
        )}
      </div>
    );
  }

  return (
    <select className={sel} value={inList ? value : ""} aria-label={ariaLabel}
      onChange={(e) => { if (e.target.value === "__other__") { setCustom(true); onChange(""); } else onChange(e.target.value); }}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__other__">{otherLabel}</option>
    </select>
  );
}
