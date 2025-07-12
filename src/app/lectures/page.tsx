import groupBy from "lodash/groupBy";

import { getLessonList } from "@/api/pages-api";
import { LessonCard } from "@/components/lesson/lesson-card";
import { CompactGrid } from "@/components/shared/compact-grid/compact-grid";

interface PageProps {
  params: Promise<object>;
}

export default async function Page({ params }: PageProps) {
  await params;
  const lessons = await getLessonList();
  const groupedByChapter = groupBy(lessons, (x) => x.section);

  return (
    <div className="tractate w-full grid gap-8">
      {Object.entries(groupedByChapter).map(([chapter, lections]) => {
        return (
          <section className="w-full grid" key={chapter}>
            <div className="border-b border-(--border) py-2 px-4 md:px-6">
              <h2 className="inline text-3xl font-semibold relative">
                {chapter}
                <span className="absolute left-full text-sm text-(--description)">
                  {lections.length}
                </span>
              </h2>
            </div>
            <CompactGrid
              containerClassName={`md:gap-6 md:p-6`}
              data={lections.map((l) => ({ ...l, id: l.title }))}
              renderItem={(item) => (
                <LessonCard key={item.title} lesson={item} />
              )}
            />
          </section>
        );
      })}
    </div>
  );
}
