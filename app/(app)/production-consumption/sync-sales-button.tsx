"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { RefreshCw } from "lucide-react";
import { syncFinishedSales } from "@/server/actions/pnc";

export function SyncSalesButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => {
      const res = await syncFinishedSales();
      if (res?.error) toast(res.error, "error");
      else {
        const r = (res.result ?? {}) as { matched?: number; oversold?: number; unmapped?: number };
        toast(`Synced: ${r.matched ?? 0} items · ${r.oversold ?? 0} oversold · ${r.unmapped ?? 0} unmapped`);
        router.refresh();
      }
    })}>
      <RefreshCw className="h-4 w-4" /> {pending ? "Syncing…" : "Sync sales → display"}
    </Button>
  );
}
