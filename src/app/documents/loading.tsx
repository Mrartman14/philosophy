// src/app/documents/loading.tsx
import { Skeleton } from "@/components/ui";
import { getT } from "@/i18n";

export default async function DocumentsLoading() {
  const t = await getT("pages");
  return (
    <div aria-busy="true" aria-label={t("documentsLoadingLabel")} className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
