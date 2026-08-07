"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Recharts is heavy and only needed on the client. Load it dynamically with
 * `ssr: false` so it is code-split out of the initial dashboard payload and
 * never runs during server render.
 */
const fallback = () => <Skeleton className="h-[240px] w-full" />;

export const RevenueTrend = dynamic(
  () => import("./dashboard-charts").then((m) => m.RevenueTrend),
  { ssr: false, loading: fallback }
);

export const BranchPerf = dynamic(
  () => import("./dashboard-charts").then((m) => m.BranchPerf),
  { ssr: false, loading: fallback }
);
