export function SkeletonTextLine({ className = "" }) {
  return (
    <div
      className={`bg-gray-300 dark:bg-gray-700 rounded animate-pulse 
            text-base leading-7 h-[1em] ${className}`}
      style={{ minHeight: "1em" }}
    />
  );
}
