import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Home, LayoutDashboard } from "lucide-react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Page not found",
  description: "The page you were looking for doesn't exist or has moved.",
  path: "/404",
});

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6 text-center">
      <Image src="/logo.png" alt="Romancham" width={160} height={42} priority className="h-10 w-auto" />
      <p className="mt-8 text-6xl font-bold tracking-tight text-primary">404</p>
      <h1 className="mt-2 text-xl font-semibold">This page couldn&apos;t be found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist, or it may have moved. Let&apos;s get you back on track.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Back to Dashboard
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background px-5 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Home className="h-4 w-4" aria-hidden="true" /> Go home
        </Link>
      </div>
    </main>
  );
}
