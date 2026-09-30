"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ATT_STATUSES, workedHours, type AttStatus } from "@/lib/attendance";
import type { StaffRow, AttRow } from "@/server/queries/attendance";
import { saveDayAttendance } from "@/server/actions/attendance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CheckCheck } from "lucide-react";

type Entry = { status: AttStatus | ""; in_time: string; out_time: string; ot_hours: string; note: string };
const shift = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const fmtDay = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function DailyAttendance({ date, today, staff, rows }: { date: string; today: string; staff: StaffRow[]; rows: AttRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const initial = useMemo(() => {
    const m: Record<string, Entry> = {};
    for (const s of staff) {
      const r = rows.find((x) => x.staff_id === s.id);
      m[s.id] = { status: (r?.status as AttStatus) ?? "", in_time: r?.in_time?.slice(0, 5) ?? "", out_time: r?.out_time?.slice(0, 5) ?? "", ot_hours: r?.ot_hours ? String(r.ot_hours) : "", note: r?.note ?? "" };
    }
    return m;
  }, [staff, rows]);
  const [e, setE] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const set = (id: string, patch: Partial<Entry>) => { setE((s) => ({ ...s, [id]: { ...s[id], ...patch } })); setDirty(true); };

  const counts = ATT_STATUSES.map((st) => ({ ...st, n: Object.values(e).filter((x) => x.status === st.key).length }));
  const unmarked = Object.values(e).filter((x) => !x.status).length;
  const future = date > today;

  function markAll() {
    setE((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.status ? v : { ...v, status: "present" as AttStatus }])));
    setDirty(true);
  }
  function save() {
    start(async () => {
      const res = await saveDayAttendance(date, Object.entries(e).map(([staff_id, v]) => ({ staff_id, ...v })));
      if (res.error) toast(res.error, "error");
      else { toast(`Attendance saved for ${fmtDay(date)}`); setDirty(false); router.refresh(); }
    });
  }

  if (staff.length === 0) {
    return <Card className="p-6 text-sm text-muted-foreground">No staff yet. Add your team in the <Link href="/attendance?tab=staff" className="text-primary underline">Staff</Link> tab.</Card>;
  }

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Link href={`/attendance?tab=daily&date=${shift(date, -1)}`} className="rounded-md border p-2 hover:bg-muted" aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></Link>
        <input type="date" value={date} max={today} aria-label="Date"
          onChange={(ev) => ev.target.value && router.push(`/attendance?tab=daily&date=${ev.target.value}`)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
        <Link href={`/attendance?tab=daily&date=${shift(date, 1)}`} className={cn("rounded-md border p-2 hover:bg-muted", date >= today && "pointer-events-none opacity-40")} aria-label="Next day"><ChevronRight className="h-4 w-4" /></Link>
        <span className="text-sm font-medium">{fmtDay(date)}{date === today && <span className="ml-1 text-primary">(today)</span>}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={markAll} disabled={future}><CheckCheck className="h-4 w-4" /> Mark rest Present</Button>
          <Button size="sm" onClick={save} disabled={pending || future}>{pending ? "Saving…" : dirty ? "Save attendance •" : "Save attendance"}</Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        {counts.map((c) => <span key={c.key} className="rounded-full border px-2 py-0.5">{c.label}: <b>{c.n}</b></span>)}
        <span className={cn("rounded-full border px-2 py-0.5", unmarked && "border-amber-500 text-amber-600")}>Not marked: <b>{unmarked}</b></span>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr><th className="p-2">Staff</th><th className="p-2">Status</th><th className="p-2">In</th><th className="p-2">Out</th><th className="p-2 text-right">Worked</th><th className="p-2">OT hrs</th><th className="p-2">Note</th></tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const v = e[s.id];
              const wh = workedHours(v.in_time, v.out_time);
              const offDay = v.status === "absent" || v.status === "week_off" || v.status === "leave";
              return (
                <tr key={s.id} className="border-b align-middle">
                  <td className="p-2"><div className="font-medium">{s.name}</div>{s.designation && <div className="text-xs text-muted-foreground">{s.designation}</div>}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {ATT_STATUSES.map((st) => (
                        <button key={st.key} type="button" title={st.label} aria-pressed={v.status === st.key}
                          onClick={() => set(s.id, { status: v.status === st.key ? "" : st.key })}
                          className={cn("min-w-9 rounded-md border px-2 py-1 text-xs font-semibold", v.status === st.key ? st.cls + " border-transparent" : "hover:bg-muted")}>
                          {st.short}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="p-2"><input type="time" value={v.in_time} disabled={offDay} onChange={(ev) => set(s.id, { in_time: ev.target.value })} className="h-8 w-28 rounded-md border border-input bg-background px-1 text-sm disabled:opacity-40" aria-label={`${s.name} in time`} /></td>
                  <td className="p-2"><input type="time" value={v.out_time} disabled={offDay} onChange={(ev) => set(s.id, { out_time: ev.target.value })} className="h-8 w-28 rounded-md border border-input bg-background px-1 text-sm disabled:opacity-40" aria-label={`${s.name} out time`} /></td>
                  <td className="p-2 text-right tabular-nums">{wh ? `${wh} h` : "—"}</td>
                  <td className="p-2"><input type="number" min="0" max="24" step="0.5" value={v.ot_hours} disabled={offDay} onChange={(ev) => set(s.id, { ot_hours: ev.target.value })} className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-40" placeholder="0" aria-label={`${s.name} overtime hours`} /></td>
                  <td className="p-2"><input value={v.note} onChange={(ev) => set(s.id, { note: ev.target.value })} className="h-8 w-40 rounded-md border border-input bg-background px-2 text-sm" placeholder="optional" aria-label={`${s.name} note`} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">P = Present · H = Half day · WO = Week off (paid) · L = Paid leave · A = Absent (unpaid). Tap a selected status again to clear it.</p>
    </div>
  );
}
