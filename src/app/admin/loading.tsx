// src/app/admin/loading.tsx
import { Skeleton } from "@/components/ui";
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
