"use client";
import { useActionState, useRef, useEffect } from "react";
import { createExpense } from "@/server/actions/expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Cat = { id: string; name: string };
const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function ExpenseForm({ categories }: { categories: Cat[] }) {
  const [state, action, pending] = useActionState(createExpense, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <select name="category_id" className={sel}><option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>Amount (₹)</Label><Input name="amount" type="number" step="0.01" required placeholder="0" /></div>
        <div className="space-y-1.5"><Label>Date</Label><Input name="expense_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} /></div>
        <div className="space-y-1.5">
          <Label>Payment</Label>
          <select name="payment_method" className={sel}>
            <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Card">Card</option><option value="Bank">Bank Transfer</option>
          </select>
        </div>
        <div className="space-y-1.5"><Label>Paid to (optional)</Label><Input name="vendor_name" placeholder="e.g. Landlord, EB" /></div>
        <div className="space-y-1.5"><Label>GST amount (optional)</Label><Input name="gst_amount" type="number" step="0.01" placeholder="0" /></div>
        <div className="space-y-1.5 lg:col-span-2"><Label>Note</Label><Input name="note" placeholder="optional" /></div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button disabled={pending}>{pending ? "Adding…" : "Add Expense"}</Button>
      </div>
    </form>
  );
}
