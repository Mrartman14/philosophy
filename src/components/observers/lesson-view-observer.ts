"use client";

import { useEffect } from "react";
import { lessonService } from "@/services/lesson-service/lesson-service";

export const LessonViewObserver: React.FC<{ slug: string }> = ({ slug }) => {
  useEffect(() => {
    lessonService.setLastViewedLessonId(slug);
  }, [slug]);

  return null;
};
