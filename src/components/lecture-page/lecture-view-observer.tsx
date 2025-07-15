"use client";

import { useCallback, useEffect, useState } from "react";

import { LecturePageData } from "@/entities/page-data";
import { FavButton } from "@/components/shared/fav-button/fav-button";
import { lectureService } from "@/services/lecture-service/lecture-service";

export const LectureViewObserver: React.FC<{ lecture: LecturePageData }> = ({
  lecture,
}) => {
  const [isFav, setIsFav] = useState(false);

  const handleFetchFav = useCallback(() => {
    return lectureService.checkIsLectureFav(lecture.slug).then(setIsFav);
  }, [lecture.slug]);

  const onSelectFav = useCallback(() => {
    return lectureService.setFavLectureId(lecture.slug).then(handleFetchFav);
  }, [lecture.slug, handleFetchFav]);

  useEffect(() => {
    lectureService.setLastViewedLectureId(lecture.slug);
  }, [lecture.slug]);

  useEffect(() => {
    handleFetchFav();
  }, [handleFetchFav]);

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
