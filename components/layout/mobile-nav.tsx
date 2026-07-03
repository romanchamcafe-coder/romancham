"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { NAV } from "./nav-items";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} side="left" label="Navigation">
        <div className="border-b px-5 py-4"><img src="/logo.png" alt="Romancham" className="h-7 w-auto" /></div>
        <nav className="space-y-1 p-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </nav>
      </Sheet>
    </>
  );
}
