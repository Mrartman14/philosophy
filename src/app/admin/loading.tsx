import { SkeletonTextLine } from "@/components/shared/skeleton/skeleton-text-line";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonTextLine className="w-48 h-6" />
      <SkeletonTextLine className="w-full h-4" />
      <SkeletonTextLine className="w-3/4 h-4" />
      <SkeletonTextLine className="w-1/2 h-4" />
    </div>
  );
}
