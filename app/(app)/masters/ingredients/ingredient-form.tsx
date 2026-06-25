"use client";
import { useActionState, useRef, useEffect } from "react";
import { createIngredient } from "@/server/actions/ingredients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function IngredientForm() {
  const [state, action, pending] = useActionState(createIngredient, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
      <Input name="name" placeholder="Ingredient name" required className="w-48" />
      <Input name="sku" placeholder="SKU" className="w-28" />
      <Input name="hsn_code" placeholder="HSN" className="w-24" />
      <Input name="default_gst_rate" type="number" step="0.01" placeholder="GST %" className="w-24" />
      <Input name="reorder_level" type="number" step="0.0001" placeholder="Reorder level" className="w-32" />
      <Button disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
