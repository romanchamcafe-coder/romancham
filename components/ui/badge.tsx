import { cn } from "@/lib/utils";

export function Badge({ className, tone = "muted", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "muted" | "green" | "red" | "amber" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)} {...props} />;
}
