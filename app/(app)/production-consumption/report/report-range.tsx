"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ReportRange({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1"><Label htmlFor="r-from">From</Label><Input id="r-from" type="date" value={f} onChange={(e) => setF(e.target.value)} className="h-9" /></div>
      <div className="space-y-1"><Label htmlFor="r-to">To</Label><Input id="r-to" type="date" value={t} onChange={(e) => setT(e.target.value)} className="h-9" /></div>
      <Button variant="outline" size="sm" onClick={() => router.push(`/production-consumption/report?from=${f}&to=${t}`)}>Apply</Button>
    </div>
  );
}
