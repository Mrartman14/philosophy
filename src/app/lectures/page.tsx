import { LectureList } from "@/components/lecture-list/lecture-list";

interface PageProps {
  params: Promise<object>;
}

export default async function Page({ params }: PageProps) {
  await params;

  return (
    <div className="w-full grid gap-8">
      <LectureList />
    </div>
  );
}
