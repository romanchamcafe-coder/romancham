"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideIndent } from "@/server/actions/requests";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

type Item = { ingredient_id: string; name: string; unit: string; qty: number };
type Row = { id: string; status: string; items: Item[]; note: string | null; created_at: string; decided_at: string | null };

const badge: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  fulfilled: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
};

export function IndentList({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const decide = (id: string, status: "approved" | "fulfilled" | "rejected") => start(async () => {
    const res = await decideIndent(id, status);
    if (res?.error) toast(res.error, "error");
    else { toast(`Indent ${status}`); router.refresh(); }
  });

  if (rows.length === 0) return <p className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">No indents yet.</p>;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Requests</p>
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${badge[r.status] ?? "bg-muted"}`}>{r.status}</span>
            <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          <ul className="mt-2 space-y-0.5 text-sm">
            {(r.items ?? []).map((it, i) => (
              <li key={i} className="flex justify-between"><span>{it.name}</span><span className="tabular-nums text-muted-foreground">{it.qty}{it.unit ? ` ${it.unit}` : ""}</span></li>
            ))}
          </ul>
          {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
          {canManage && (r.status === "pending" || r.status === "approved") && (
            <div className="mt-3 flex gap-2">
              {r.status === "pending" && <>
                <Button size="sm" className="flex-1" disabled={pending} onClick={() => decide(r.id, "approved")}>Approve</Button>
                <Button size="sm" variant="outline" className="flex-1" disabled={pending} onClick={() => decide(r.id, "rejected")}>Reject</Button>
              </>}
              {r.status === "approved" && <Button size="sm" className="flex-1" disabled={pending} onClick={() => decide(r.id, "fulfilled")}>Mark fulfilled</Button>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
