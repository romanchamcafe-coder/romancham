"use client";
import { useEffect, useState } from "react";
import { Monitor, Sun, Moon } from "lucide-react";

type Theme = "system" | "light" | "dark";

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = ((typeof localStorage !== "undefined" && localStorage.getItem("theme")) || "system") as Theme;
    setTheme(saved);
    // When on "system", follow OS changes live.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem("theme") || "system") === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    try { localStorage.setItem("theme", t); } catch { /* ignore */ }
    applyTheme(t);
  };

  const opts: { v: Theme; label: string; Icon: typeof Monitor }[] = [
    { v: "system", label: "System", Icon: Monitor },
    { v: "light", label: "Light", Icon: Sun },
    { v: "dark", label: "Dark", Icon: Moon },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border p-1" role="group" aria-label="Appearance">
      {opts.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => choose(v)}
          aria-pressed={theme === v}
          aria-label={label}
          title={label}
          className={
            "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors " +
            (theme === v ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60")
          }
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
