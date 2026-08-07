"use client";
import { useActionState } from "react";
import { createOrg } from "@/server/actions/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WelcomeForm() {
  const [state, action, pending] = useActionState(createOrg, null);
  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="mb-1 text-lg font-semibold">Set up your business</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          One quick step to finish. What&apos;s your business called?
        </p>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org_name">Business name</Label>
            <Input id="org_name" name="org_name" required placeholder="e.g. Strictly Desserts" autoFocus />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button className="w-full" disabled={pending}>{pending ? "Setting up…" : "Continue"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
