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
  return <Link href="/purchases/new"><Button>+ New Purchase</Button></Link>;
}
