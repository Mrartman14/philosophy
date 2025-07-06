"use client";

import { useEffect } from "react";

import { structure } from "@/utils/structure";
import { lessonService } from "@/services/lesson-service/lesson-service";
import { appBadgeService } from "@/services/badge-service/badge-service";

export const NewLessonsProvider: React.FC = () => {
  useEffect(() => {
    async function checkForNewLessons() {
      const lessonCount = structure.length;
      const lastCount = await lessonService.getLastLessonsCount();

      const viewedLessonIds = await lessonService.getViewedLessonIds();
      const unviewedLessons = structure.filter(
        (lesson) => !viewedLessonIds.includes(lesson.slug)
      );

      const nextUnviewedLessonIds =
        lessonCount > lastCount
          ? unviewedLessons.length
          : unviewedLessons.length; // можно детализировать сравнение по ID

      await appBadgeService.updateAppBadge(nextUnviewedLessonIds);
      await lessonService.setLastLessonsCount(lessonCount);
    }

    checkForNewLessons();
  }, []);

  return null;
};
