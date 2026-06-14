// src/features/banners/ui/banner-export-links.tsx
/**
 * Ссылки на .md/.txt выгрузки баннера. Контент рендерит бек
 * (GET /api/admin/banners/{id}.md|.txt — гейт banner.read), но эти эндпоинты
 * принимают только Bearer-токен, которого нет при браузерной навигации.
 * Поэтому ссылки ведут на прокси-роут /admin/banners/[id]/export (route.ts),
 * который подкладывает токен из httpOnly-cookie (паттерн events).
 */
interface Props {
  id: string;
}

export function BannerExportLinks({ id }: Props) {
  return (
    <span className="flex items-center gap-2 text-xs">
      <a
        href={`/admin/banners/${id}/export?format=md`}
        className="hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        .md
      </a>
      <a
        href={`/admin/banners/${id}/export?format=txt`}
        className="hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        .txt
      </a>
    </span>
  );
}
