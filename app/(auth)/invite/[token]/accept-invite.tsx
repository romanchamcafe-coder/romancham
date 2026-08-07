"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/server/actions/team";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export function AcceptInvite({ token, orgName }: { token: string; orgName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const accept = () =>
    start(async () => {
      const res = await acceptInvitation(token);
      if (res?.error) { toast(res.error, "error"); return; }
      toast(`Welcome to ${orgName}!`);
      router.push("/dashboard");
    });

  return (
    <Button className="w-full" onClick={accept} disabled={pending}>
      {pending ? "Joining…" : `Join ${orgName}`}
    </Button>
  );
}
