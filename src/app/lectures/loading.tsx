// src/app/lectures/loading.tsx
import { Skeleton } from "@/components/ui";

export default function LecturesLoading() {
  return (
    <div aria-busy="true" aria-label="Загрузка лекций…" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
