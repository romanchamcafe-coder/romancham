"use client";
import { useEffect, useState } from "react";
import { subscribeToast, type ToastMsg } from "@/lib/toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const toneStyles: Record<string, string> = {
  success: "border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/60 dark:text-green-200",
  error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200",
  info: "border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-card dark:text-foreground",
};

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);

  useEffect(() => {
    return subscribeToast((t) => {
      setItems((cur) => [...cur, t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 3500);
    });
  }, []);

  const remove = (id: number) => setItems((cur) => cur.filter((x) => x.id !== id));

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {items.map((t) => {
        const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? AlertCircle : Info;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-md ${toneStyles[t.tone] ?? toneStyles.info}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1">{t.text}</span>
            <button
              onClick={() => remove(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
