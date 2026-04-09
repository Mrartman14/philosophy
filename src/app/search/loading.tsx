import { SkeletonTextLine } from "@/components/shared/skeleton/skeleton-text-line";

export default function Loading() {
  return (
    <div className="w-full p-4 flex flex-col gap-4">
      <SkeletonTextLine className="w-48 h-6" />
      <SkeletonTextLine className="w-full h-4" />
      <SkeletonTextLine className="w-5/6 h-4" />
      <SkeletonTextLine className="w-3/4 h-4" />
      <SkeletonTextLine className="w-2/3 h-4" />
    </div>
  );
}
