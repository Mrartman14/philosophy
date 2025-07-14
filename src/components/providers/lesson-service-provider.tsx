"use client";

import { useCallback, useEffect, useState } from "react";

import { LessonPageData } from "@/entities/page-data";
import { lessonService } from "@/services/lesson-service/lesson-service";
import { useAppPageConfig } from "@/app/_providers/app-page-client-provider";

type LessonServiceProviderState = {
  lectures: LessonPageData[];
  favLessons: LessonPageData[];
  lastViewedLessons: LessonPageData[];
  onSelectFav: (lessonId: string) => Promise<void>;
};
type LessonServiceProviderProps = {
  children:
    | React.ReactNode
    | ((state: LessonServiceProviderState) => React.ReactNode);
};
export const LessonServiceProvider: React.FC<LessonServiceProviderProps> = ({
  children,
}) => {
  const { lectures } = useAppPageConfig();

  const [favLessons, setFavLessons] = useState<LessonPageData[]>([]);
  const [lastViewedLessons, setLastViewedLessons] = useState<LessonPageData[]>(
    []
  );

  const checkLastViews = useCallback(async () => {
    const lastViewedLessonIds = await lessonService.getLastViewedLessonIds();
    if (lastViewedLessonIds.length === 0) {
      return;
    }

    const next = lectures
      .filter((l) => lastViewedLessonIds.includes(l.slug))
      .toReversed();
    setLastViewedLessons(next);
  }, [lectures]);

  const checkFav = useCallback(async () => {
    const favLessonIds = await lessonService.getFavLessonIds();

    if (favLessonIds.length === 0) {
      return;
    }

    const next = lectures.filter((l) => favLessonIds.includes(l.slug));
    setFavLessons(next);
  }, [lectures]);

  const onSelectFav = useCallback(
    (id: string) => {
      return lessonService.setFavLessonId(id).then(checkFav);
    },
    [checkFav]
  );

  useEffect(() => {
    checkLastViews();
  }, [checkLastViews]);

  useEffect(() => {
    checkFav();
  }, [checkFav]);

  const state: LessonServiceProviderState = {
    favLessons,
    lectures,
    lastViewedLessons,
    onSelectFav,
  };

  return typeof children === "function" ? children(state) : children;
};
