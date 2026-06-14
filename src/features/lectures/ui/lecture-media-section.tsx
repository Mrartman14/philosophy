import Link from "next/link";

import { getLectureMedia } from "../api";

interface Props {
  lectureId: string;
}

/**
 * Секция «Медиа лекции» на публичной странице (read-only список со ссылками
 * на /media/{id}). Данные — GET /api/lectures/{id}/media (по sort_order).
 * Плеер живёт на странице медиа; здесь — навигационный список (composition
 * через страницу, рендер плеера — слайс media на своей странице).
 */
export async function LectureMediaSection({ lectureId }: Props) {
  const items = await getLectureMedia(lectureId);
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Медиа лекции">
      <h2 className="text-lg font-semibold">Медиа лекции</h2>
      <ul className="flex flex-col gap-1">
        {items.map((m) => (
          <li key={m.id}>
            <Link
              href={`/media/${m.id}`}
              className="text-sm underline hover:no-underline"
            >
              {m.filename}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
