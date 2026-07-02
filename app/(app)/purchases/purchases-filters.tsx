"use client";
import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";

const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function PurchasesFilters({ vendors, categories }: { vendors: string[]; categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [search, setSearch] = useState(sp.get("q") ?? "");
  const [vendor, setVendor] = useState(sp.get("vendor") ?? "");
  const [invoice, setInvoice] = useState(sp.get("invoice") ?? "");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  const [category, setCategory] = useState(sp.get("category") ?? "");

  const apply = () => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("q", search.trim());
    if (vendor) p.set("vendor", vendor);
    if (invoice.trim()) p.set("invoice", invoice.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (category) p.set("category", category);
    router.push(`${pathname}?${p.toString()}`);
  };
  const clear = () => { setSearch(""); setVendor(""); setInvoice(""); setFrom(""); setTo(""); setCategory(""); router.push(pathname); };
  const active = search || vendor || invoice || from || to || category;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="p-search">Search</Label>
          <Input id="p-search" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") apply(); }} placeholder="Product, vendor or invoice" aria-label="Search purchases" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-vendor">Vendor</Label>
          <select id="p-vendor" className={sel} value={vendor} onChange={(e) => setVendor(e.target.value)} aria-label="Vendor">
            <option value="">All vendors</option>
            {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-invoice">Invoice no.</Label>
          <Input id="p-invoice" value={invoice} onChange={(e) => setInvoice(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") apply(); }} placeholder="Invoice number" aria-label="Invoice number" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-from">From</Label>
          <Input id="p-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-to">To</Label>
          <Input id="p-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-category">Category</Label>
          <select id="p-category" className={sel} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
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
