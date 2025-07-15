"use client";

import { useCallback, useEffect, useState } from "react";

import { LessonPageData } from "@/entities/page-data";
import { FavButton } from "@/components/shared/fav-button/fav-button";
import { lessonService } from "@/services/lesson-service/lesson-service";

export const LectureViewObserver: React.FC<{ lecture: LessonPageData }> = ({
  lecture,
}) => {
  const [isFav, setIsFav] = useState(false);

  const handleFetchFav = useCallback(() => {
    return lessonService.checkIsLessonFav(lecture.slug).then(setIsFav);
  }, [lecture.slug]);

  const onSelectFav = useCallback(() => {
    return lessonService.setFavLessonId(lecture.slug).then(handleFetchFav);
  }, [lecture.slug, handleFetchFav]);

  useEffect(() => {
    lessonService.setLastViewedLessonId(lecture.slug);
  }, [lecture.slug]);

  useEffect(() => {
    handleFetchFav();
  }, [handleFetchFav]);

  return (
    <FavButton
      isFav={isFav}
      onSelect={onSelectFav}
      className={`${isFav ? "" : ""}`}
    />
  );
};
