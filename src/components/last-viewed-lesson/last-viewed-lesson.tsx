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
      <div className="width-full gap-4 flex flex-nowrap overflow-scroll">
        {lastViewedLessons.map((x) => (
          <LessonCard
            key={x.slug}
            lesson={x}
            className="grow-0 shrink-0 basis-[200px] md:basis-[300px] h-[150px] md:h-[200px]"
          />
        ))}
      </div>
    </>
  ) : null;
};
