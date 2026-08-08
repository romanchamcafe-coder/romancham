"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectProvider, disconnectProvider, syncNow } from "@/server/actions/pos";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export function ConnectorActions({ providerKey, status, available }: {
  providerKey: string; status: string; available: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<any>, ok: string) => start(async () => {
    const res = await fn();
    if (res?.error) toast(res.error, "error");
    else { toast(ok); router.refresh(); }
  });

  return (
    <div className="flex gap-2">
      {status === "connected" ? (
        <>
          <Button size="sm" variant="outline" className="flex-1" disabled={pending}
            onClick={() => run(() => syncNow(providerKey), "Sync started")}>Sync now</Button>
          <Button size="sm" variant="ghost" disabled={pending}
            onClick={() => run(() => disconnectProvider(providerKey), "Disconnected")}>Disconnect</Button>
        </>
      ) : (
        <Button size="sm" variant="outline" className="flex-1" disabled={pending}
          onClick={() => run(() => connectProvider(providerKey), available ? "Connected" : "Enabled — API sync coming soon")}>
          Connect
        </Button>
      )}
    </div>
  );
}
