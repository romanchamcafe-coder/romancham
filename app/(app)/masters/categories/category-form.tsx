"use client";
import { useActionState, useRef, useEffect } from "react";
import { createCategory } from "@/server/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CategoryForm() {
  const [state, action, pending] = useActionState(createCategory, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
      <Input name="name" placeholder="Category name (e.g. Dairy)" required className="w-64" />
      <Button disabled={pending}>{pending ? "Adding…" : "Add Category"}</Button>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
