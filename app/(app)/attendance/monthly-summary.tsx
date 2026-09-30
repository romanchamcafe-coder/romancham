"use client";
import { useRouter } from "next/navigation";
import { ATT_STATUSES, SHOW_OT, STATUS_BY_KEY, computePay, emptyCounts, monthBounds, type AttStatus, type Counts } from "@/lib/attendance";
import type { StaffRow, AttRow, PayRow, AdvanceRow } from "@/server/queries/attendance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inr, cn } from "@/lib/utils";
import { Download } from "lucide-react";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function MonthlySummary({ month, today, showPay, staff, attendance, pay, advances }: {
  month: string; today: string; showPay: boolean; staff: StaffRow[]; attendance: AttRow[]; pay: PayRow[]; advances: AdvanceRow[];
}) {
  const router = useRouter();
  const { days } = monthBounds(month);
  // Days that can have attendance so far (future days are not "unmarked").
  const lastDay = month < today.slice(0, 7) ? days : month === today.slice(0, 7) ? Number(today.slice(8, 10)) : 0;
  const dayList = Array.from({ length: days }, (_, i) => i + 1);

  const byStaff = new Map<string, Map<number, AttRow>>();
  for (const a of attendance) {
    const m = byStaff.get(a.staff_id) ?? new Map<number, AttRow>();
    m.set(Number(a.att_date.slice(8, 10)), a); byStaff.set(a.staff_id, m);
  }
  const payBy = new Map(pay.map((p) => [p.staff_id, p]));
  const advBy = new Map<string, number>();
  for (const a of advances) advBy.set(a.staff_id, (advBy.get(a.staff_id) ?? 0) + a.amount);

  // Show active staff + inactive staff who have attendance this month.
  const people = staff.filter((s) => s.is_active || byStaff.has(s.id));
  const rows = people.map((s) => {
    const m = byStaff.get(s.id) ?? new Map();
    const c: Counts = emptyCounts();
    for (const d of dayList) {
      const a = m.get(d);
      if (a && (STATUS_BY_KEY as any)[a.status]) { c[a.status as AttStatus] += 1; c.otHours += a.ot_hours; }
      else if (d <= lastDay) c.unmarked += 1;
    }
    const p = payBy.get(s.id);
    const calc = computePay({ monthly: p?.monthly_salary ?? 0, otRate: p?.ot_rate_per_hour ?? null, days, counts: c, advances: advBy.get(s.id) ?? 0 });
    return { s, m, c, p, calc };
  });
  const tot = rows.reduce((t, r) => {
    for (const st of ATT_STATUSES) t.c[st.key] += r.c[st.key];
    t.c.unmarked += r.c.unmarked; t.c.otHours += r.c.otHours;
    t.salary += r.p?.monthly_salary ?? 0; t.earned += r.calc.earned; t.ot += r.calc.otPay; t.adv += r.calc.advances; t.net += r.calc.net;
    return t;
  }, { c: emptyCounts(), salary: 0, earned: 0, ot: 0, adv: 0, net: 0 });

  function exportCsv() {
    const head = ["Staff", "Designation", ...ATT_STATUSES.map((s) => s.label), "Not marked", ...(SHOW_OT ? ["OT hours"] : []),
      ...(showPay ? ["Monthly salary", "Per day", "Paid days", "Earned", ...(SHOW_OT ? ["OT rate/hr", "OT pay"] : []), "Advances", "Net payable"] : []),
      ...dayList.map((d) => String(d))];
    const lines = [head, ...rows.map((r) => [
      r.s.name, r.s.designation ?? "", ...ATT_STATUSES.map((st) => r.c[st.key]), r.c.unmarked, ...(SHOW_OT ? [r2(r.c.otHours)] : []),
      ...(showPay ? [r.p?.monthly_salary ?? 0, r2(r.calc.perDay), r.calc.paidDays, r2(r.calc.earned), ...(SHOW_OT ? [r2(r.calc.hourly), r2(r.calc.otPay)] : []), r2(r.calc.advances), r2(r.calc.net)] : []),
      ...dayList.map((d) => { const a = r.m.get(d); return a ? (STATUS_BY_KEY as any)[a.status]?.short ?? "" : ""; }),
    ])];
    const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const blob = new Blob([lines.map((l) => l.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `attendance-${month}.csv`; a.click();
  }

  const monthLabel = new Date(month + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <input type="month" value={month} max={today.slice(0, 7)} aria-label="Month"
          onChange={(e) => e.target.value && router.push(`/attendance?tab=summary&month=${e.target.value}`)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
        <span className="text-sm font-medium">{monthLabel} · {days} days</span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv} disabled={rows.length === 0}><Download className="h-4 w-4" /> Export CSV</Button>
      </Card>

      {showPay && (
        <div className={cn("grid grid-cols-2 gap-3", SHOW_OT ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Total monthly salary</p><p className="mt-1 text-xl font-bold">{inr(tot.salary)}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Earned (days worked)</p><p className="mt-1 text-xl font-bold">{inr(tot.earned)}</p></Card>
          {SHOW_OT && <Card className="p-4"><p className="text-xs text-muted-foreground">Overtime pay · {r2(tot.c.otHours)} h</p><p className="mt-1 text-xl font-bold">{inr(tot.ot)}</p></Card>}
          <Card className="p-4"><p className="text-xs text-muted-foreground">Net payable (after {inr(tot.adv)} advances)</p><p className="mt-1 text-xl font-bold text-primary">{inr(tot.net)}</p></Card>
        </div>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2">Staff</th>
              {ATT_STATUSES.map((s) => <th key={s.key} className="p-2 text-center" title={s.label}>{s.short}</th>)}
              <th className="p-2 text-center" title="Not marked">—</th>{SHOW_OT && <th className="p-2 text-right">OT h</th>}
              {showPay && <><th className="p-2 text-right">Salary</th><th className="p-2 text-right">Per day</th><th className="p-2 text-right">Paid days</th><th className="p-2 text-right">Earned</th>{SHOW_OT && <th className="p-2 text-right">OT pay</th>}<th className="p-2 text-right">Advance</th><th className="p-2 text-right">Net payable</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, c, p, calc }) => (
              <tr key={s.id} className={cn("border-b", !s.is_active && "opacity-60")}>
                <td className="p-2"><div className="font-medium">{s.name}</div>{s.designation && <div className="text-xs text-muted-foreground">{s.designation}</div>}</td>
                {ATT_STATUSES.map((st) => <td key={st.key} className="p-2 text-center tabular-nums">{c[st.key] || ""}</td>)}
                <td className={cn("p-2 text-center tabular-nums", c.unmarked && "text-amber-600")}>{c.unmarked || ""}</td>
                {SHOW_OT && <td className="p-2 text-right tabular-nums">{c.otHours ? r2(c.otHours) : ""}</td>}
                {showPay && <>
                  <td className="p-2 text-right tabular-nums">{p?.monthly_salary ? inr(p.monthly_salary) : <span className="text-amber-600">not set</span>}</td>
                  <td className="p-2 text-right tabular-nums">{inr(calc.perDay)}</td>
                  <td className="p-2 text-right tabular-nums">{calc.paidDays}</td>
                  <td className="p-2 text-right tabular-nums">{inr(calc.earned)}</td>
                  {SHOW_OT && <td className="p-2 text-right tabular-nums">{calc.otPay ? inr(calc.otPay) : "—"}</td>}
                  <td className="p-2 text-right tabular-nums">{calc.advances ? `− ${inr(calc.advances)}` : "—"}</td>
                  <td className="p-2 text-right font-semibold tabular-nums">{inr(calc.net)}</td>
                </>}
              </tr>
            ))}
            <tr className="bg-muted/40 font-semibold">
              <td className="p-2">Total ({rows.length})</td>
              {ATT_STATUSES.map((st) => <td key={st.key} className="p-2 text-center tabular-nums">{tot.c[st.key] || ""}</td>)}
              <td className="p-2 text-center tabular-nums">{tot.c.unmarked || ""}</td>
              {SHOW_OT && <td className="p-2 text-right tabular-nums">{tot.c.otHours ? r2(tot.c.otHours) : ""}</td>}
              {showPay && <><td className="p-2 text-right">{inr(tot.salary)}</td><td /><td /><td className="p-2 text-right">{inr(tot.earned)}</td>{SHOW_OT && <td className="p-2 text-right">{inr(tot.ot)}</td>}<td className="p-2 text-right">{tot.adv ? `− ${inr(tot.adv)}` : "—"}</td><td className="p-2 text-right text-primary">{inr(tot.net)}</td></>}
            </tr>
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto">
        <div className="border-b px-3 py-2 text-sm font-medium">Day-wise register</div>
        <table className="text-xs">
          <thead><tr><th className="sticky left-0 bg-card p-1.5 text-left">Staff</th>{dayList.map((d) => <th key={d} className="w-7 p-1 text-center font-normal text-muted-foreground">{d}</th>)}</tr></thead>
          <tbody>
            {rows.map(({ s, m }) => (
              <tr key={s.id} className="border-t">
                <td className="sticky left-0 whitespace-nowrap bg-card p-1.5 font-medium">{s.name}</td>
                {dayList.map((d) => {
                  const a = m.get(d); const st = a ? (STATUS_BY_KEY as any)[a.status] : null;
                  return <td key={d} className="p-0.5 text-center">{st
                    ? <span title={`${st.label}${SHOW_OT && a!.ot_hours ? ` · OT ${a!.ot_hours}h` : ""}`} className={cn("inline-block min-w-6 rounded px-0.5 py-0.5 text-[10px] font-semibold", st.cls)}>{st.short}</span>
                    : <span className={cn("text-muted-foreground/40", d <= lastDay && "text-amber-500")}>{d <= lastDay ? "·" : ""}</span>}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {showPay && <p className="text-xs text-muted-foreground">Pay = monthly salary ÷ {days} days × paid days (Present, Week off, Paid leave = 1 · Half day = 0.5 · Absent/not marked = 0).{SHOW_OT ? " OT = hours × OT rate (default: per-day ÷ 8)." : ""} Advances in this month are deducted.</p>}
    </div>
  );
}
