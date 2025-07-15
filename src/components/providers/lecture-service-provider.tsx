"use client";

import { useCallback, useEffect, useState } from "react";

import { LecturePageData } from "@/entities/page-data";
import { lectureService } from "@/services/lecture-service/lecture-service";
import { useAppPageConfig } from "@/app/_providers/app-page-client-provider";

type LectureServiceProviderState = {
  lectures: LecturePageData[];
  favLectures: LecturePageData[];
  lastViewedLectures: LecturePageData[];
  onSelectFav: (lectureId: string) => Promise<void>;
};
type LectureServiceProviderProps = {
  children:
    | React.ReactNode
    | ((state: LectureServiceProviderState) => React.ReactNode);
};
export const LectureServiceProvider: React.FC<LectureServiceProviderProps> = ({
  children,
}) => {
  const { lectures } = useAppPageConfig();

  const [favLectures, setFavLectures] = useState<LecturePageData[]>([]);
  const [lastViewedLectures, setLastViewedLectures] = useState<
    LecturePageData[]
  >([]);

  const handleFetchLastViews = useCallback(async () => {
    const lastViewedLectureIds = await lectureService.getLastViewedLectureIds();
    if (lastViewedLectureIds.length === 0) {
      return;
    }

    const next = lastViewedLectureIds
      .map((id) => lectures.find((l) => l.slug === id))
      .filter((x) => !!x);

    setLastViewedLectures(next);
  }, [lectures]);

  const handleFetchFav = useCallback(async () => {
    const favLectureIds = await lectureService.getFavLectureIds();

    if (favLectureIds.length === 0) {
      return setFavLectures([]);
    }

    const next = favLectureIds
      .map((id) => lectures.find((l) => l.slug === id))
      .filter((x) => !!x);

    setFavLectures(next);
  }, [lectures]);

  const onSelectFav = useCallback(
    (id: string) => {
      return lectureService.setFavLectureId(id).then(handleFetchFav);
    },
    [handleFetchFav]
  );

  useEffect(() => {
    handleFetchLastViews();
  }, [handleFetchLastViews]);

  useEffect(() => {
    handleFetchFav();
  }, [handleFetchFav]);

  const state: LectureServiceProviderState = {
    favLectures,
    lectures,
    lastViewedLectures,
    onSelectFav,
  };

  return typeof children === "function" ? children(state) : children;
};
