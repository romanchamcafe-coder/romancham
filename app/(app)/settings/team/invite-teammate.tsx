"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";

const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function InviteTeammate() {
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-dashed p-4">
      <h3 className="text-sm font-semibold">Invite a Teammate</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="inv-email">Email</Label>
          <Input id="inv-email" type="email" placeholder="teammate@email.com" disabled className="opacity-50" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-role">Role</Label>
          <select id="inv-role" className={sel + " opacity-50"} disabled defaultValue="Manager" aria-label="Role">
            <option>Manager</option>
            <option>Accountant</option>
            <option>Staff</option>
          </select>
        </div>
        <div className="flex items-end">
          <Tooltip content="Coming soon — email invites are in development" side="top">
            <Button disabled aria-disabled="true">Send Invite</Button>
          </Tooltip>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Team invites via email are coming soon.</p>
    </div>
  );
}
