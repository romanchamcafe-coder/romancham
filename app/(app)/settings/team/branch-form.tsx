"use client";
import { useActionState, useRef, useEffect } from "react";
import { addBranch } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BranchForm() {
  const [state, action, pending] = useActionState(addBranch, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2">
      <Input name="name" placeholder="New branch name" required className="w-56" aria-label="New branch name" />
      <Input name="state_code" placeholder="State code (e.g. 33)" className="w-40" aria-label="Branch state code" />
      <Button disabled={pending}>{pending ? "Adding…" : "Add Branch"}</Button>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
