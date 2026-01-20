"use client";

import { useEffect, useState } from "react";

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

  const fetchFav = async () => {
    const favLectureIds = await lectureService.getFavLectureIds();
    if (favLectureIds.length === 0) {
      return setFavLectures([]);
    }
    const next = favLectureIds
      .map((id) => lectures.find((l) => l.slug === id))
      .filter((x) => !!x);
    setFavLectures(next);
  };

  const onSelectFav = (id: string) =>
    lectureService.setFavLectureId(id).then(fetchFav);

  useEffect(() => {
    const fetchLastViews = async () => {
      const ids = await lectureService.getLastViewedLectureIds();
      if (ids.length === 0) return;
      const next = ids
        .map((id) => lectures.find((l) => l.slug === id))
        .filter((x) => !!x);
      setLastViewedLectures(next);
    };

    const fetchFavLectures = async () => {
      const ids = await lectureService.getFavLectureIds();
      if (ids.length === 0) return setFavLectures([]);
      const next = ids
        .map((id) => lectures.find((l) => l.slug === id))
        .filter((x) => !!x);
      setFavLectures(next);
    };

    fetchLastViews();
    fetchFavLectures();
  }, [lectures]);

  const state: LectureServiceProviderState = {
    favLectures,
    lectures,
    lastViewedLectures,
    onSelectFav,
  };

  return typeof children === "function" ? children(state) : children;
};
