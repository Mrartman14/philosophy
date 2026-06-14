// src/features/media/ui/media-containers.tsx
import Link from "next/link";

import type { MediaAttachment } from "../types";

interface Props {
  containers: MediaAttachment[];
}

/**
 * Read-only список лекций, к которым привязано медиа (GET
 * /api/media/{id}/attachments). Бек отдаёт только container_id без заголовка —
 * показываем ссылку «Лекция <короткий-id>». Обогащение заголовками — задача
 * lecture-enrichment (волна 3). Generic-компонент attachments (ветка
 * documents) здесь намеренно НЕ используется: он может быть ещё не смержен
 * на момент мержа media, и cross-feature-импорт сломал бы сборку.
 */
export function MediaContainers({ containers }: Props) {
  const lectures = containers.filter((c) => c.container_type === "lecture");
  if (lectures.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">
        Медиа не прикреплено ни к одной лекции.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {lectures.map((c) => (
        <li key={`${c.container_id ?? ""}-${c.entity_id ?? ""}`}>
          <Link
            href={`/lectures/${c.container_id ?? ""}`}
            className="underline hover:no-underline"
          >
            Лекция {(c.container_id ?? "").slice(0, 8)}…
          </Link>
        </li>
      ))}
    </ul>
  );
}
