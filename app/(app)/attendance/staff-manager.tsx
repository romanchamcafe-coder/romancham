"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StaffRow, PayRow } from "@/server/queries/attendance";
import { saveStaff, type StaffInput } from "@/server/actions/attendance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { inr, cn } from "@/lib/utils";
import { Pencil, Plus } from "lucide-react";

type Form = { id?: string; name: string; designation: string; phone: string; joined_on: string; is_active: boolean; monthly_salary: string; ot_rate_per_hour: string };
const blank: Form = { name: "", designation: "", phone: "", joined_on: "", is_active: true, monthly_salary: "", ot_rate_per_hour: "" };
const fld = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function StaffManager({ staff, pay, showPay }: { staff: StaffRow[]; pay: PayRow[]; showPay: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<Form | null>(null);
  const payBy = new Map(pay.map((p) => [p.staff_id, p]));
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [k]: k === "is_active" ? e.target.checked : e.target.value } : f));

  function edit(s: StaffRow) {
    const p = payBy.get(s.id);
    setForm({ id: s.id, name: s.name, designation: s.designation ?? "", phone: s.phone ?? "", joined_on: s.joined_on ?? "", is_active: s.is_active,
      monthly_salary: p ? String(p.monthly_salary) : "", ot_rate_per_hour: p?.ot_rate_per_hour != null ? String(p.ot_rate_per_hour) : "" });
  }
  function save() {
    if (!form) return;
    const input: StaffInput = { id: form.id, name: form.name, designation: form.designation, phone: form.phone, joined_on: form.joined_on, is_active: form.is_active };
    if (showPay) { input.monthly_salary = form.monthly_salary; input.ot_rate_per_hour = form.ot_rate_per_hour; }
    start(async () => {
      const res = await saveStaff(input);
      if (res.error) toast(res.error, "error");
      else { toast(form.id ? "Staff updated" : "Staff added"); setForm(null); router.refresh(); }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{staff.filter((s) => s.is_active).length} active staff{showPay ? " · salaries are visible only to owner / managers" : ""}</p>
        <Button size="sm" onClick={() => setForm({ ...blank })}><Plus className="h-4 w-4" /> Add staff</Button>
      </div>

      {form && (
        <Card className="space-y-3 p-4">
          <p className="font-medium">{form.id ? "Edit staff" : "Add staff"}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs">Name *<input className={fld} value={form.name} onChange={set("name")} autoFocus /></label>
            <label className="space-y-1 text-xs">Designation<input className={fld} value={form.designation} onChange={set("designation")} placeholder="e.g. Chef, Helper" /></label>
            <label className="space-y-1 text-xs">Phone<input className={fld} value={form.phone} onChange={set("phone")} inputMode="tel" /></label>
            <label className="space-y-1 text-xs">Joined on<input type="date" className={fld} value={form.joined_on} onChange={set("joined_on")} /></label>
            {showPay && <>
              <label className="space-y-1 text-xs">Monthly salary (₹)<input type="number" min="0" className={fld} value={form.monthly_salary} onChange={set("monthly_salary")} placeholder="e.g. 15000" /></label>
              <label className="space-y-1 text-xs">OT rate per hour (₹)<input type="number" min="0" className={fld} value={form.ot_rate_per_hour} onChange={set("ot_rate_per_hour")} placeholder="auto = per-day ÷ 8" /></label>
            </>}
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={set("is_active")} /> Active</label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            <Button size="sm" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr><th className="p-2">#</th><th className="p-2">Name</th><th className="p-2">Designation</th><th className="p-2">Phone</th><th className="p-2">Joined</th>{showPay && <><th className="p-2 text-right">Monthly salary</th><th className="p-2 text-right">OT / hr</th></>}<th className="p-2">Status</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {staff.map((s, i) => {
              const p = payBy.get(s.id);
              return (
                <tr key={s.id} className={cn("border-b", !s.is_active && "opacity-50")}>
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 font-medium">{s.name}</td>
                  <td className="p-2">{s.designation ?? "—"}</td>
                  <td className="p-2">{s.phone ?? "—"}</td>
                  <td className="p-2">{s.joined_on ?? "—"}</td>
                  {showPay && <>
                    <td className="p-2 text-right tabular-nums">{p?.monthly_salary ? inr(p.monthly_salary) : <span className="text-amber-600">not set</span>}</td>
                    <td className="p-2 text-right tabular-nums">{p?.ot_rate_per_hour != null ? inr(p.ot_rate_per_hour) : "auto"}</td>
                  </>}
                  <td className="p-2">{s.is_active ? <span className="text-green-600">Active</span> : "Inactive"}</td>
                  <td className="p-2 text-right"><button type="button" onClick={() => edit(s)} className="rounded p-1 hover:bg-muted" aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" /></button></td>
                </tr>
              );
            })}
            {staff.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">No staff yet — click Add staff.</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">To remove someone who has left, edit them and untick Active — their past attendance stays in the records.</p>
    </div>
  );
}
