"use client";

import groupBy from "lodash/groupBy";

import { LectureCard } from "../lecture/lecture-card";
// import { CompactGrid } from "../shared/compact-grid/compact-grid";
import { LectureServiceProvider } from "../providers/lecture-service-provider";

export const LectureList: React.FC = () => {
  return (
    <LectureServiceProvider>
      {({ lectures, favLectures, onSelectFav }) => {
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
                  <LectureCard
                    key={x.slug}
                    lecture={x}
                    onSelectFav={() => onSelectFav(x.slug)}
                    isFav={favLectures.some((y) => y.slug === x.slug)}
                  />
                ))}
              </div>
            </section>
          );
        });
      }}
    </LectureServiceProvider>
  );
};
