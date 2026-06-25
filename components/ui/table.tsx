import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <div className="w-full overflow-auto"><table className={cn("w-full text-sm", className)} {...props} /></div>;
}
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className="border-b bg-muted/50" {...p} />;
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} />;
export const TR = (p: React.HTMLAttributes<HTMLTableRowElement>) => <tr className="border-b hover:bg-muted/40" {...p} />;
export const TH = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn("h-10 px-3 text-left font-medium text-muted-foreground", className)} {...p} />;
export const TD = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-3 py-2", className)} {...p} />;
