"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV as nav } from "./nav-items";

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 overflow-y-auto border-r bg-card md:block">
      <div className="px-5 py-4">
        <Image src="/logo.png" alt="Romancham" width={107} height={28} priority className="h-7 w-auto" />
      </div>
      <nav aria-label="Primary" className="space-y-1 px-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
