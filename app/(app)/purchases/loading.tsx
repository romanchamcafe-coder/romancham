import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            {Array.from({ length: 5 }).map((__, j) => <Skeleton key={j} className="h-5 flex-1" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
