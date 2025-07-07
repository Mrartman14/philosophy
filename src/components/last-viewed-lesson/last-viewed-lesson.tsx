"use client";

import { useEffect, useState } from "react";

import { LessonPageData } from "@/entities/page-data";
import { LessonCard } from "@/components/lesson/lesson-card";
import { lessonService } from "@/services/lesson-service/lesson-service";
import { useAppPageConfig } from "@/app/_providers/app-page-client-provider";

export const LastViewedLesson: React.FC = () => {
  const { lectures } = useAppPageConfig();

  const [lastViewedLessons, setLastViewedLessons] = useState<LessonPageData[]>(
    []
  );

  useEffect(() => {
    async function checkLastViews() {
      const lastViewedLessonIds = await lessonService.getLastViewedLessonIds();
      if (lastViewedLessonIds.length === 0) {
        return;
      }

      const next = lectures.filter((l) => lastViewedLessonIds.includes(l.slug));
      setLastViewedLessons(next);
    }

    checkLastViews();
  }, [lectures]);

  return lastViewedLessons.length > 0 ? (
    <>
      <h2>История посещений</h2>
      <div
        className="width-full grid gap-4 auto-rows-[150px] md:auto-rows-[200px]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
      >
        {lastViewedLessons.map((x) => (
          <LessonCard
            // className="aspect-video"
            lesson={x}
            key={x.slug}
          />
        ))}
      </div>
    </>
  ) : null;
};
