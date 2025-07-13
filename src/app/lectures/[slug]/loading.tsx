import { SkeletonTextBlock } from "@/components/shared/skeleton/skeleton-text-block";

const Loading: React.FC = () => {
  return <SkeletonTextBlock className="w-[65ch] p-4" rows={50} />;
};
export default Loading;
