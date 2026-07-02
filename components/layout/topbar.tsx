"use client";
import { useState, useEffect } from "react";
import { signOut } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function Topbar({ orgName, branches, activeBranch }: {
  orgName: string;
  branches: { id: string; name: string }[];
  activeBranch: string | null;
}) {
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirm(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm]);

  function setBranch(id: string) {
    document.cookie = `bm_branch=${id}; path=/; max-age=31536000`;
    location.reload();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="font-semibold">{orgName}</div>
      <div className="flex items-center gap-3">
        <label htmlFor="branch-switch" className="sr-only">Select branch</label>
        <select id="branch-switch" aria-label="Select branch" value={activeBranch ?? ""} onChange={(e) => setBranch(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <Button variant="ghost" size="sm" onClick={() => setConfirm(true)} aria-haspopup="dialog"><LogOut className="h-4 w-4" /> Sign out</Button>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog" aria-modal="true" aria-labelledby="signout-title" onClick={() => setConfirm(false)}>
          <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 id="signout-title" className="text-base font-semibold">Sign out of Romancham?</h2>
            <p className="mt-1 text-sm text-muted-foreground">You&apos;ll need to log in again to access your dashboard.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirm(false)}>Cancel</Button>
              <form action={signOut}><Button variant="destructive" size="sm" type="submit">Sign out</Button></form>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
