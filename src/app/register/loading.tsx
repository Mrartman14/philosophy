import { SkeletonTextLine } from "@/components/shared/skeleton/skeleton-text-line";

export default function Loading() {
  return (
    <div className="w-full flex justify-center p-4 md:p-8">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <SkeletonTextLine className="w-40 h-6" />
        <SkeletonTextLine className="w-full h-10" />
        <SkeletonTextLine className="w-full h-10" />
        <SkeletonTextLine className="w-full h-10" />
        <SkeletonTextLine className="w-28 h-9" />
      </div>
    </div>
  );
}
