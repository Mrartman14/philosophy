// src/features/lectures/ui/lecture-header-view.tsx
// Изоморфный (client-safe) рендер обложки + заголовка + даты лекции.
// Используется как онлайн LectureDetail, так и офлайн SavedLectureView.
// НЕ импортирует ничего server-only: ./api, ./actions, ./permissions, ./schemas.
// Принимает уже вычисленный coverSrc пропом — вычисление URL остаётся на
// стороне потребителя (online: lectureCoverUrl; offline: resolveStorageUrl).
"use client";

export interface LectureHeaderViewProps {
  title: string;
  date: string;
  coverSrc: string | null;
  coverAlt?: string;
}

export function LectureHeaderView({
  title,
  date,
  coverSrc,
  coverAlt = "",
}: LectureHeaderViewProps) {
  return (
    <>
      {coverSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverSrc}
          alt={coverAlt}
          className="max-h-80 w-full rounded-lg object-cover"
        />
      )}
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-sm text-(--color-description)">{date}</p>
    </>
  );
}
