import { Fragment } from "react";
import groupBy from "lodash/groupBy";

import { getLessonList } from "@/api/pages-api";
import { LessonCard } from "@/components/lesson/lesson-card";

interface PageProps {
  params: Promise<object>;
}

export default async function Page({ params }: PageProps) {
  await params;
  const lessons = await getLessonList();
  const groupedByChapter = groupBy(lessons, (x) => x.section);

  return (
    <div className="prose dark:prose-invert w-full max-w-full p-4 grid gap-4">
      {Object.entries(groupedByChapter).map(([chapter, lections]) => (
        <Fragment key={chapter}>
          <div>
            <h2 className="inline text-4xl font-semibold relative">
              {chapter}
              <span className="absolute left-full text-sm text-(--description)">
                {lections.length}
              </span>
            </h2>
          </div>
          <div
            className="w-full gap-4"
            style={{
              display: "grid",
              // gridTemplateRows: "masonry",
              gridAutoRows: "200px",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            }}
          >
            {lections.map((item) => {
              return <LessonCard key={item.title} lesson={item} />;
            })}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
