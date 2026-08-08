"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreIngredient } from "@/server/actions/ingredients";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { RotateCcw, Archive, ChevronDown } from "lucide-react";

export function ArchivedPanel({ items }: { items: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (items.length === 0) return null;

  const restore = (id: string) => start(async () => {
    const res = await restoreIngredient(id);
    if (res.error) toast(res.error, "error");
    else { toast("Ingredient restored"); router.refresh(); }
  });

  return (
    <div className="rounded-lg border bg-muted/30">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium">
        <span className="flex items-center gap-2"><Archive className="h-4 w-4 text-muted-foreground" /> Recently deleted ({items.length})</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-1 border-t p-2">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-background">
              <span>{i.name}</span>
              <Button size="sm" variant="outline" onClick={() => restore(i.id)} disabled={pending}>
                <RotateCcw className="h-3.5 w-3.5" /> Restore
              </Button>
            </div>
          ))}
          <p className="px-2 pt-1 text-xs text-muted-foreground">Deleting an ingredient only archives it — nothing is lost, and it can be restored here anytime.</p>
        </div>
      )}
    </div>
  );
}
