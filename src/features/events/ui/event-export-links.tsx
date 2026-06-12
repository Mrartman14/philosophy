// src/features/events/ui/event-export-links.tsx
/**
 * Ссылки на .md/.txt выгрузки события. Контент рендерит бек
 * (GET /api/admin/events/{id}.md|.txt), но эти эндпоинты принимают только
 * Bearer-токен, которого нет при браузерной навигации. Поэтому ссылки ведут
 * на прокси-роут /admin/events/[id]/export (route.ts), который подкладывает
 * токен из httpOnly-cookie.
 */
interface Props {
  id: string;
}

export function EventExportLinks({ id }: Props) {
  return (
    <span className="flex items-center gap-2 text-xs">
      <a
        href={`/admin/events/${id}/export?format=md`}
        className="hover:underline"
        target="_blank"
        rel="noopener"
      >
        .md
      </a>
      <a
        href={`/admin/events/${id}/export?format=txt`}
        className="hover:underline"
        target="_blank"
        rel="noopener"
      >
        .txt
      </a>
    </span>
  );
}
