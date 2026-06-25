"use client";
import { useActionState, useRef, useEffect } from "react";
import { createVendor } from "@/server/actions/vendors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VendorForm() {
  const [state, action, pending] = useActionState(createVendor, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
      <Input name="name" placeholder="Vendor name" required className="w-48" />
      <Input name="gstin" placeholder="GSTIN" className="w-40" />
      <Input name="state_code" placeholder="State code (e.g. 33)" className="w-36" />
      <Input name="phone" placeholder="Phone" className="w-32" />
      <Input name="email" placeholder="Email" className="w-44" />
      <Input name="payment_terms_days" type="number" placeholder="Terms (days)" className="w-28" />
      <Button disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
