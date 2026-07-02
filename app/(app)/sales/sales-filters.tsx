"use client";
import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";

const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function SalesFilters({ payments, categories }: { payments: string[]; categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [search, setSearch] = useState(sp.get("q") ?? "");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  const [payment, setPayment] = useState(sp.get("payment") ?? "");
  const [category, setCategory] = useState(sp.get("category") ?? "");

  const apply = () => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("q", search.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (payment) p.set("payment", payment);
    if (category) p.set("category", category);
    router.push(`${pathname}?${p.toString()}`);
  };
  const clear = () => { setSearch(""); setFrom(""); setTo(""); setPayment(""); setCategory(""); router.push(pathname); };

  const active = search || from || to || payment || category;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="sales-search">Search</Label>
          <Input id="sales-search" value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
            placeholder="Item, invoice or customer" aria-label="Search sales" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sales-from">From</Label>
          <Input id="sales-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sales-to">To</Label>
          <Input id="sales-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sales-payment">Payment</Label>
          <select id="sales-payment" className={sel} value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Payment type">
            <option value="">All</option>
            {payments.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sales-category">Category</Label>
          <select id="sales-category" className={sel} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={apply}><Search className="mr-1 h-4 w-4" /> Apply filters</Button>
        {active && <Button size="sm" variant="outline" onClick={clear}><X className="mr-1 h-4 w-4" /> Clear</Button>}
      </div>
    </div>
  );
}
