"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/server/actions/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="mb-1 text-lg font-semibold">Reset your password</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter your account email and we&apos;ll send you a link to set a new password.
        </p>
        {state?.message ? (
          <div className="space-y-4">
            <p className="rounded-md bg-primary/10 p-3 text-sm text-foreground">{state.message}</p>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-primary underline">Back to sign in</Link>
            </p>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@cafe.com" />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button className="w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
            <p className="text-center text-sm text-muted-foreground">
              Remembered it? <Link href="/login" className="text-primary underline">Back to sign in</Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
