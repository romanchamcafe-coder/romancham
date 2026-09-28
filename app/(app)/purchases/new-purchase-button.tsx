"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

export function NewPurchaseButton({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <Tooltip content="Add at least one vendor and one ingredient first" side="bottom">
        <Button disabled aria-disabled="true">+ New Purchase</Button>
      </Tooltip>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/purchases/import"><Button variant="outline">Import from Excel</Button></Link>
      <Link href="/purchases/new"><Button>+ New Purchase</Button></Link>
    </div>
  );
}
