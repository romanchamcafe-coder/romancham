import Link from "next/link";
import { Button } from "@/components/ui/button";

type Action = { label: string; href: string };

export function EmptyState({ icon, title, description, primary, secondary, className }: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  primary?: Action;
  secondary?: Action;
  className?: string;
}) {
  return (
    <div className={"flex flex-col items-center justify-center gap-2 px-6 py-10 text-center " + (className ?? "")}>
      {icon && <div className="mb-1 text-muted-foreground/60" aria-hidden>{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {(primary || secondary) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {primary && <Link href={primary.href}><Button size="sm">{primary.label}</Button></Link>}
          {secondary && <Link href={secondary.href}><Button size="sm" variant="outline">{secondary.label}</Button></Link>}
        </div>
      )}
    </div>
  );
}
