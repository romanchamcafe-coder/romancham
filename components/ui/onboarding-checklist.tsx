import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";

export type OnboardingStep = {
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
};

export function OnboardingChecklist({
  title, description, steps,
}: { title: string; description?: string; steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const nextIdx = steps.findIndex((s) => !s.done);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {doneCount} of {steps.length} done
        </span>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => {
          const isNext = i === nextIdx;
          return (
            <li key={s.title} className={"flex items-start gap-3 rounded-lg border p-3 " + (isNext ? "border-primary/40 bg-primary/5" : "border-transparent")}>
              {s.done
                ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden />
                : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className={"text-sm font-medium " + (s.done ? "text-muted-foreground line-through" : "")}>{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
              {!s.done && (
                <Link href={s.href} className="shrink-0">
                  <Button size="sm" variant={isNext ? "default" : "outline"}>{s.cta}</Button>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
