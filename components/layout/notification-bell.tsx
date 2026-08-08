"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import type { Notification } from "@/server/queries/notifications";
import { markNotificationRead, markAllNotificationsRead } from "@/server/actions/notifications";

const dot: Record<string, string> = {
  critical: "bg-red-500", high: "bg-amber-500", medium: "bg-blue-500", low: "bg-slate-400",
};

export function NotificationBell({ items, unread }: { items: Notification[]; unread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const openItem = (n: Notification) => {
    start(async () => { await markNotificationRead(n.id); router.refresh(); });
    if (n.href) { setOpen(false); router.push(n.href); }
  };
  const readAll = () => start(async () => { await markAllNotificationsRead(); router.refresh(); });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-haspopup="true" aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={readAll} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Check className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
            ) : items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`flex w-full items-start gap-2 border-b px-3 py-2.5 text-left last:border-0 hover:bg-muted/50 ${n.read_at ? "opacity-60" : ""}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[n.priority] ?? "bg-slate-400"}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{n.title}</span>
                  {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                </span>
                {!n.read_at && <span className="ml-auto mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
