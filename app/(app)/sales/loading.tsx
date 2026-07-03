import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-24" />
      {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </div>
      <div className="flex justify-end gap-2"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-28" /></div>
      <div className="space-y-3 rounded-lg border bg-card p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            {Array.from({ length: 6 }).map((__, j) => <Skeleton key={j} className="h-5 flex-1" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
