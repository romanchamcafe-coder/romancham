"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/server/actions/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, null);
  return (
    <Card>
      <CardContent className="pt-6">
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Your name</Label>
            <Input id="full_name" name="full_name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org_name">Business name</Label>
            <Input id="org_name" name="org_name" required placeholder="Strictly Desserts" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={6} />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state?.message && <p className="text-sm text-green-600">{state.message}</p>}
          <Button className="w-full" disabled={pending}>{pending ? "Creating…" : "Create account"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="text-primary underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
