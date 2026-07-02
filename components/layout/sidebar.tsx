"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Boxes, Store, Tags, Ruler, ChefHat, ShoppingCart, IndianRupee, Package, Receipt, Settings,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/masters/ingredients", label: "Ingredients", icon: Boxes },
  { href: "/masters/vendors", label: "Vendors", icon: Store },
  { href: "/masters/categories", label: "Categories", icon: Tags },
  { href: "/masters/units", label: "Units (UOM)", icon: Ruler },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/sales", label: "Sales", icon: IndianRupee },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/settings/team", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 border-r bg-card md:block">
      <div className="px-5 py-4"><img src="/logo.png" alt="Romancham" className="h-7 w-auto" /></div>
      <nav className="space-y-1 px-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              <Icon className="h-4 w-4" /> {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
