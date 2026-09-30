"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StaffRow, AdvanceRow } from "@/server/queries/attendance";
import { addAdvance, deleteAdvance } from "@/server/actions/attendance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { toast } from "@/lib/toast";
import { inr } from "@/lib/utils";
import { Trash2 } from "lucide-react";

const fld = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function AdvancesPanel({ month, today, staff, allStaff, advances }: { month: string; today: string; staff: StaffRow[]; allStaff: StaffRow[]; advances: AdvanceRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ staff_id: "", adv_date: today, amount: "", note: "" });
  const name = new Map(allStaff.map((s) => [s.id, s.name]));
  const total = advances.reduce((s, a) => s + a.amount, 0);

  function add() {
    start(async () => {
      const res = await addAdvance(f);
      if (res.error) toast(res.error, "error");
      else { toast("Advance recorded"); setF({ ...f, amount: "", note: "" }); router.refresh(); }
    });
  }
  function del(id: string) {
    if (!confirm("Delete this advance?")) return;
    start(async () => {
      const res = await deleteAdvance(id);
      if (res.error) toast(res.error, "error"); else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-4">
        <p className="font-medium">Record a salary advance</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-xs lg:col-span-2">Staff<SearchSelect value={f.staff_id} onChange={(v) => setF({ ...f, staff_id: v })} options={staff.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select staff…" ariaLabel="Staff" /></label>
          <label className="space-y-1 text-xs">Date<input type="date" className={fld} value={f.adv_date} max={today} onChange={(e) => setF({ ...f, adv_date: e.target.value })} /></label>
          <label className="space-y-1 text-xs">Amount (₹)<input type="number" min="1" className={fld} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
          <label className="space-y-1 text-xs">Note<input className={fld} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="optional" /></label>
        </div>
        <Button size="sm" onClick={add} disabled={pending}>{pending ? "Saving…" : "Add advance"}</Button>
      </Card>

      <Card className="overflow-x-auto">
        <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
          <span className="font-medium">Advances in {month}</span>
          <span>Total <b>{inr(total)}</b> — deducted in the monthly summary</span>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-2">Date</th><th className="p-2">Staff</th><th className="p-2 text-right">Amount</th><th className="p-2">Note</th><th className="p-2" /></tr></thead>
          <tbody>
            {advances.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="p-2">{a.adv_date}</td><td className="p-2">{name.get(a.staff_id) ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{inr(a.amount)}</td><td className="p-2">{a.note ?? ""}</td>
                <td className="p-2 text-right"><button type="button" onClick={() => del(a.id)} className="rounded p-1 text-muted-foreground hover:text-destructive" aria-label="Delete advance"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {advances.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No advances this month.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
