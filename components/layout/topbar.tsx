"use client";
import { signOut } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function Topbar({ orgName, branches, activeBranch }: {
  orgName: string;
  branches: { id: string; name: string }[];
  activeBranch: string | null;
}) {
  function setBranch(id: string) {
    document.cookie = `bm_branch=${id}; path=/; max-age=31536000`;
    location.reload();
  }
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="font-semibold">{orgName}</div>
      <div className="flex items-center gap-3">
        <select value={activeBranch ?? ""} onChange={(e) => setBranch(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <form action={signOut}>
          <Button variant="ghost" size="sm"><LogOut className="h-4 w-4" /> Sign out</Button>
        </form>
      </div>
    </header>
  );
}
