import { getActiveContext } from "@/lib/auth/session";
import { getExpenses, getExpenseCategories } from "@/server/queries/expenses";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ExpenseForm } from "./expense-form";
import { CategoryManager } from "../masters/categories/category-manager";
import { inr } from "@/lib/utils";
import { Settings2 } from "lucide-react";

export default async function ExpensesPage() {
  const ctx = await getActiveContext();
  const [rows, categories] = await Promise.all([
    getExpenses(ctx!.orgId!, ctx!.branch?.id ?? null),
    getExpenseCategories(ctx!.orgId!),
  ]);
  const total = rows.reduce((s: number, r: any) => s + Number(r.amount), 0);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Expenses</h1>
        <p className="text-sm text-muted-foreground">Rent, salaries, utilities, marketing, maintenance… these flow into Net Profit on the dashboard.</p>
      </div>

      <ExpenseForm categories={categories} />

      <details className="rounded-lg border bg-card">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
          <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          Manage expense categories
          <span className="ml-auto text-xs text-muted-foreground">{categories.length} active</span>
        </summary>
        <div className="border-t p-4">
          <CategoryManager rows={categories} type="expense" />
        </div>
      </details>

      <Card className="overflow-x-auto">
        <Table>
          <THead><TR><TH>Date</TH><TH>Category</TH><TH>Paid To</TH><TH>Payment</TH><TH className="text-right">Amount</TH><TH>Note</TH></TR></THead>
          <TBody>
            {rows.map((r: any) => (
              <TR key={r.id}>
                <TD>{r.expense_date}</TD>
                <TD>{r.categories?.name ?? "—"}</TD>
                <TD>{r.vendor_name ?? "—"}</TD>
                <TD>{r.payment_method ?? "—"}</TD>
                <TD className="text-right font-medium tabular-nums">{inr(r.amount)}</TD>
                <TD>{r.note ?? "—"}</TD>
              </TR>
            ))}
            {rows.length === 0 && <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">No expenses yet.</TD></TR>}
          </TBody>
        </Table>
      </Card>
      {rows.length > 0 && <p className="text-sm text-muted-foreground">Total (shown): <span className="font-semibold text-foreground">{inr(total)}</span></p>}
    </div>
  );
}
