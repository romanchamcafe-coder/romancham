"use client";
import { useActionState } from "react";
import Link from "next/link";
import { updatePassword } from "@/server/actions/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="mb-1 text-lg font-semibold">Choose a new password</h1>
        <p className="mb-4 text-sm text-muted-foreground">Enter a new password for your account.</p>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" required minLength={6} placeholder="At least 6 characters" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" name="confirm" type="password" required minLength={6} />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button className="w-full" disabled={pending}>{pending ? "Saving…" : "Save new password"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary underline">Back to sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
