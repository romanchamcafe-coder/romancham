// Shared attendance constants + pure pay maths (used by server and client).

export const ATT_STATUSES = [
  { key: "present", short: "P", label: "Present", pay: 1, cls: "bg-green-600 text-white" },
  { key: "half_day", short: "H", label: "Half day", pay: 0.5, cls: "bg-amber-500 text-white" },
  { key: "week_off", short: "WO", label: "Week off", pay: 1, cls: "bg-sky-600 text-white" },
  { key: "leave", short: "L", label: "Paid leave", pay: 1, cls: "bg-violet-600 text-white" },
  { key: "absent", short: "A", label: "Absent", pay: 0, cls: "bg-red-600 text-white" },
] as const;
export type AttStatus = (typeof ATT_STATUSES)[number]["key"];
export const STATUS_BY_KEY = Object.fromEntries(ATT_STATUSES.map((s) => [s.key, s])) as Record<AttStatus, (typeof ATT_STATUSES)[number]>;
export const isStatus = (s: unknown): s is AttStatus => typeof s === "string" && s in STATUS_BY_KEY;

// Roles that may see salaries / advances / pay summary (raw roles, not tiers).
const PAY_ROLES = new Set(["owner", "admin", "branch_manager", "manager", "accountant", "accounts"]);
export const canSeePay = (role: string | null | undefined) => PAY_ROLES.has(role ?? "");

// Overtime is switched off for now — flip to true to bring back OT hours,
// OT rate and OT pay everywhere (data model already supports it).
export const SHOW_OT = false;

export const SHIFT_HOURS = 8; // used for the automatic hourly OT rate

export function daysInMonth(month: string) { // "YYYY-MM"
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function monthBounds(month: string) {
  const d = daysInMonth(month);
  return { from: `${month}-01`, to: `${month}-${String(d).padStart(2, "0")}`, days: d };
}
export function workedHours(inT?: string | null, outT?: string | null) {
  if (!inT || !outT) return 0;
  const [ih, im] = inT.split(":").map(Number), [oh, om] = outT.split(":").map(Number);
  let mins = (oh * 60 + om) - (ih * 60 + im);
  if (mins < 0) mins += 24 * 60; // night shift crossing midnight
  return Math.round((mins / 60) * 100) / 100;
}

export type Counts = Record<AttStatus, number> & { unmarked: number; otHours: number };
export function emptyCounts(): Counts {
  return { present: 0, half_day: 0, week_off: 0, leave: 0, absent: 0, unmarked: 0, otHours: 0 };
}

export function computePay(o: { monthly: number; otRate: number | null; days: number; counts: Counts; advances: number }) {
  const perDay = o.days > 0 ? o.monthly / o.days : 0;
  const paidDays = ATT_STATUSES.reduce((s, st) => s + o.counts[st.key] * st.pay, 0);
  const hourly = o.otRate != null && o.otRate > 0 ? o.otRate : perDay / SHIFT_HOURS;
  const earned = perDay * paidDays;
  const otPay = SHOW_OT ? hourly * o.counts.otHours : 0;
  const gross = earned + otPay;
  return { perDay, paidDays, hourly, earned, otPay, gross, advances: o.advances, net: gross - o.advances };
}
