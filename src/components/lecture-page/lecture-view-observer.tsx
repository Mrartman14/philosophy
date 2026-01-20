"use client";

import { useEffect, useState } from "react";

import { LecturePageData } from "@/entities/page-data";
import { FavButton } from "@/components/shared/fav-button/fav-button";
import { lectureService } from "@/services/lecture-service/lecture-service";

export const LectureViewObserver: React.FC<{ lecture: LecturePageData }> = ({
  lecture,
}) => {
  const [isFav, setIsFav] = useState(false);

  const fetchFav = () =>
    lectureService.checkIsLectureFav(lecture.slug).then(setIsFav);

  const onSelectFav = () =>
    lectureService.setFavLectureId(lecture.slug).then(fetchFav);

  useEffect(() => {
    lectureService.setLastViewedLectureId(lecture.slug);
    lectureService.checkIsLectureFav(lecture.slug).then(setIsFav);
  }, [lecture.slug]);

  return (
    <menu>
      <li>
        <FavButton
          isFav={isFav}
          onSelect={onSelectFav}
          className={`px-3 py-3 ${isFav ? "" : ""}`}
        />
      </li>
    </menu>
  );
};
