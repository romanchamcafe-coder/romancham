export type RangeKey =
  | "today" | "yesterday" | "7d" | "30d" | "90d"
  | "this_month" | "prev_month" | "this_year" | "custom";

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days",
  "90d": "Last 90 days", this_month: "This month", prev_month: "Previous month",
  this_year: "This year", custom: "Custom range",
};

export const RANGE_ORDER: RangeKey[] = ["today", "yesterday", "7d", "30d", "90d", "this_month", "prev_month", "this_year", "custom"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function resolveRange(key: RangeKey, fromP?: string, toP?: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let from: Date, to: Date;
  switch (key) {
    case "today": from = today; to = today; break;
    case "yesterday": from = addDays(today, -1); to = addDays(today, -1); break;
    case "7d": from = addDays(today, -6); to = today; break;
    case "90d": from = addDays(today, -89); to = today; break;
    case "this_month": from = new Date(today.getFullYear(), today.getMonth(), 1); to = today; break;
    case "prev_month": from = new Date(today.getFullYear(), today.getMonth() - 1, 1); to = new Date(today.getFullYear(), today.getMonth(), 0); break;
    case "this_year": from = new Date(today.getFullYear(), 0, 1); to = today; break;
    case "custom": from = fromP ? new Date(fromP) : addDays(today, -29); to = toP ? new Date(toP) : today; break;
    case "30d": default: from = addDays(today, -29); to = today; break;
  }
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 864e5) + 1);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { from: iso(from), to: iso(to), prevFrom: iso(prevFrom), prevTo: iso(prevTo), label: RANGE_LABELS[key] ?? RANGE_LABELS["30d"], key };
}
