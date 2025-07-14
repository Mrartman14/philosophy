"use client";

import groupBy from "lodash/groupBy";

import { LessonCard } from "../lesson/lesson-card";
// import { CompactGrid } from "../shared/compact-grid/compact-grid";
import { LessonServiceProvider } from "../providers/lesson-service-provider";

export const LessonList: React.FC = () => {
  return (
    <LessonServiceProvider>
      {({ lectures, favLessons, onSelectFav }) => {
        const groupedByChapter = groupBy(lectures, (x) => x.section);
        return Object.entries(groupedByChapter).map(([chapter, lections]) => {
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
              <div
                className={`grid p-4 gap-4 auto-rows-[300px] md:auto-rows-[250px] md:gap-6 md:p-6`}
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                }}
              >
                {lections.map((x) => (
                  <LessonCard
                    key={x.title}
                    lesson={x}
                    onSelectFav={() => onSelectFav(x.slug)}
                    isFav={favLessons.some((y) => y.slug === x.slug)}
                  />
                ))}
              </div>
              {/* <CompactGrid
                containerClassName={`auto-rows-[300px] md:auto-rows-[200px] md:gap-6 md:p-6`}
                data={lections.map((x) => ({ ...x, id: x.title }))}
                renderItem={(x) => (
                  <LessonCard
                    key={x.title}
                    lesson={x}
                    onSelectFav={() => onSelectFav(x.slug)}
                    isFav={favLessons.some((y) => y.slug === x.slug)}
                  />
                )}
              /> */}
            </section>
          );
        });
      }}
    </LessonServiceProvider>
  );
};
