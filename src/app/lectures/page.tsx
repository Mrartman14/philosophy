import { Fragment } from "react";
import groupBy from "lodash/groupBy";

import { LessonPageData, structure } from "@/utils/structure";

interface PageProps {
  params: Promise<object>;
}

export default async function Page({ params }: PageProps) {
  await params;
  const groupedByChapter = groupBy(structure, (x) => x.section);

  return (
    <div className="w-full p-4 grid gap-4 md:border-l md:border-r md:border-(--border)">
      {Object.entries(groupedByChapter).map(([chapter, lections]) => (
        <Fragment key={chapter}>
          <div>
            <h2 className="inline-block text-4xl font-semibold relative">
              {chapter}
              <span className="absolute top-0 left-full text-sm text-(--description)">
                {lections.length}
              </span>
            </h2>
          </div>
          <div
            className="w-full gap-4"
            style={{
              display: "grid",
              // gridTemplateRows: "masonry",
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

export const LessonCard: React.FC<{ lesson: LessonPageData }> = ({
  lesson,
}) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <a
      href={`/lectures/${lesson.slug}`}
      className="group relative rounded-xl border border-(--border) overflow-hidden"
    >
      <img
        src={`${basePath}${lesson.cover}`}
        style={{ margin: 0 }}
        className="object-cover transition-transform duration-500 scale-150 group-hover:scale-100 group-focus:scale-100"
      />
      <div className="absolute p-0.5 bottom-2 right-0 w-full bg-(--text-pane)">
        <h3 className="text-xl font-semibold">
          {lesson.order}. {lesson.title}
        </h3>
      </div>
    </a>
  );
};
