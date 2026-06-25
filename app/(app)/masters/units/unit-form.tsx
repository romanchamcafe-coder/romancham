"use client";
import { useActionState, useRef, useEffect } from "react";
import { createUnit } from "@/server/actions/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UnitForm() {
  const [state, action, pending] = useActionState(createUnit, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
      <Input name="name" placeholder="Unit name (e.g. Kilogram)" required className="w-56" />
      <Input name="abbr" placeholder="Short (e.g. kg)" required className="w-32" />
      <Button disabled={pending}>{pending ? "Adding…" : "Add UOM"}</Button>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
