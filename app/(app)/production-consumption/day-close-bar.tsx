"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { Lock, Unlock } from "lucide-react";
import { closeDay, reopenDay } from "@/server/actions/pnc";

export function DayCloseBar({ businessDate, closed }: { businessDate: string; closed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, ok: string) => start(async () => {
    const res = await fn();
    if (res?.error) toast(res.error, "error"); else { toast(ok); router.refresh(); }
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        Today ({businessDate}) is <b>{closed ? "closed" : "open"}</b>. Closing a day locks backdated entries — only owners/managers can post to or reopen it.
      </span>
      {closed ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => reopenDay(businessDate), "Day reopened")}><Unlock className="h-4 w-4" /> Reopen day</Button>
      ) : (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => closeDay(businessDate), "Day closed")}><Lock className="h-4 w-4" /> Close day</Button>
      )}
    </div>
  );
}
