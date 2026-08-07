"use client";
import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/server/actions/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function NextField() {
  const sp = useSearchParams();
  const next = sp.get("next") ?? "";
  return <input type="hidden" name="next" value={next} />;
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <Card>
      <CardContent className="pt-6">
        <form action={action} className="space-y-4">
          <Suspense fallback={null}><NextField /></Suspense>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="you@cafe.com" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary underline">Forgot password?</Link>
            </div>
            <Input id="password" name="password" type="password" required />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            New here? <Link href="/signup" className="text-primary underline">Create an account</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
