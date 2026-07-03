"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV as nav } from "./nav-items";

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
