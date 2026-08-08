"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { REPORT_DEFS } from "@/lib/report-defs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const sel = "h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// group report defs for the optgroups
const groups = Array.from(new Set(REPORT_DEFS.map((d) => d.group)));

export function ReportControls({ report, from, to }: { report: string; from: string; to: string }) {
  const router = useRouter();
  const [r, setR] = useState(report);
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  const run = () => router.push(`/reports?report=${encodeURIComponent(r)}&from=${f}&to=${t}`);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-[220px] flex-1 space-y-1.5">
        <Label htmlFor="rep">Report</Label>
        <select id="rep" className={sel + " w-full"} value={r} onChange={(e) => setR(e.target.value)}>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {REPORT_DEFS.filter((d) => d.group === g).map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="from">From</Label>
        <Input id="from" type="date" value={f} onChange={(e) => setF(e.target.value)} className="w-[150px]" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="to">To</Label>
        <Input id="to" type="date" value={t} onChange={(e) => setT(e.target.value)} className="w-[150px]" />
      </div>
      <Button onClick={run}>Run report</Button>
    </div>
  );
}
