"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

  const lectureMap = useMemo(
    () => new Map(lectures.map((l) => [l.slug, l])),
    [lectures]
  );

  const [favLectures, setFavLectures] = useState<LecturePageData[]>([]);
  const [lastViewedLectures, setLastViewedLectures] = useState<
    LecturePageData[]
  >([]);

  const fetchFav = useCallback(async () => {
    const ids = await lectureService.getFavLectureIds();
    if (ids.length === 0) return setFavLectures([]);
    setFavLectures(ids.map((id) => lectureMap.get(id)).filter((x) => !!x));
  }, [lectureMap]);

  const onSelectFav = useCallback(
    (id: string) => lectureService.setFavLectureId(id).then(fetchFav),
    [fetchFav]
  );

  useEffect(() => {
    const fetchLastViews = async () => {
      const ids = await lectureService.getLastViewedLectureIds();
      if (ids.length === 0) return;
      setLastViewedLectures(ids.map((id) => lectureMap.get(id)).filter((x) => !!x));
    };

    fetchLastViews();
    fetchFav();
  }, [lectureMap, fetchFav]);

  const state: LectureServiceProviderState = {
    favLectures,
    lectures,
    lastViewedLectures,
    onSelectFav,
  };

  return typeof children === "function" ? children(state) : children;
};
