"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftLowStockPurchaseRequests } from "@/server/actions/requests";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { Wand2 } from "lucide-react";

export function AutoDraftButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    const res = await draftLowStockPurchaseRequests();
    if (res.error) toast(res.error, "error");
    else { toast(`Drafted ${res.created} purchase request${res.created === 1 ? "" : "s"} · ${res.items} item${res.items === 1 ? "" : "s"}`); router.refresh(); }
  });
  return (
    <Button size={size} variant="outline" onClick={run} disabled={pending}>
      <Wand2 className="h-4 w-4" /> {pending ? "Drafting…" : "Auto-draft PRs from low stock"}
    </Button>
  );
}
