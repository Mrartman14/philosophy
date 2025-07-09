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
    <div className="prose md:prose-xl dark:prose-invert w-full max-w-full grid gap-8">
      {Object.entries(groupedByChapter).map(([chapter, lections]) => {
        return (
          <section className="w-full gap-4 grid static" key={chapter}>
            <div className="border-b border-(--border) p-4 bg-(--background) sticky top-(--header-height) z-10">
              <h2 className="inline text-4xl font-semibold relative">
                {chapter}
                <span className="absolute left-full text-sm text-(--description)">
                  {lections.length}
                </span>
              </h2>
            </div>
            <CompactGrid
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

// style={{
//   gridColumnStart: item.columnStart,
//   gridRowStart: item.rowStart,
//   gridColumnEnd: `span ${item.colSpan}`,
//   gridRowEnd: `span ${item.rowSpan}`,
// }}
