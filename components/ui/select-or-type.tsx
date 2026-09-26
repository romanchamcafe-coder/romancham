"use client";
import { SearchSelect } from "./search-select";

/**
 * Pick from a list (searchable, A→Z) or type a new value — typing a name that
 * isn't in the list offers "Use "…"". Kept as a thin wrapper so every screen
 * that used the old dropdown gets search automatically.
 */
export function SelectOrType({
  value, onChange, options, placeholder = "Select…", ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  ariaLabel?: string;
  otherLabel?: string;
}) {
  const opts = Array.from(new Set(options.filter(Boolean))).map((o) => ({ value: o, label: o }));
  return (
    <SearchSelect value={value} onChange={onChange} options={opts} placeholder={placeholder}
      ariaLabel={ariaLabel} allowCustom emptyLabel={value ? "— Clear —" : undefined} />
  );
}
