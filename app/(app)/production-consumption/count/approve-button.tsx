"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { approvePhysicalCount } from "@/server/actions/pnc";

export function ApproveButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => {
      const res = await approvePhysicalCount(id);
      if (res?.error) toast(res.error, "error"); else { toast("Count approved — ledger adjusted"); router.refresh(); }
    })}>{pending ? "…" : "Approve"}</Button>
  );
}
