"use client";
// src/features/semantic-map/ui/map-point-panel.tsx
import { IconButton, RouterLink } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { MapPointDetail } from "../types";

/**
 * Overlay-карточка деталей точки-чанка. Заголовок берём из MapData.documents
 * (id документа → заголовок; ручка деталей заголовок не отдаёт). snippet —
 * plaintext ≤1000 рун (подтверждено бэком 2026-06-22), рендерим как ТЕКСТ
 * (React экранирует); визуальный line-clamp ниже, без FE-обрезки.
 */
export function MapPointPanel({
  detail,
  documents,
  onClose,
}: {
  detail: MapPointDetail;
  documents: Record<string, string>;
  onClose: () => void;
}) {
  const t = useT("semanticMap");
  // doc держим nullable (как в схеме), чтобы `??`-цепочка заголовка была
  // настоящей: заголовок из карты → сам id документа → плейсхолдер, когда
  // detail.doc вовсе нет.
  const doc = detail.doc;
  const title = (doc !== undefined ? documents[doc] : undefined) ?? doc ?? t("pointPanelUntitled");

  return (
    <div className="absolute bottom-3 start-3 max-w-sm rounded-md bg-(--color-surface) p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <IconButton aria-label={t("pointPanelClose")} compact onClick={onClose}>
          {"×"}
        </IconButton>
      </div>
      {typeof detail.chunk_ord === "number" && (
        <p className="mt-1 text-xs text-(--color-fg-muted)">
          {t("pointPanelChunk", { ord: detail.chunk_ord })}
        </p>
      )}
      {detail.snippet && (
        <p className="mt-2 line-clamp-4 text-sm text-(--color-fg)">{detail.snippet}</p>
      )}
      {doc && (
        <RouterLink href={`/documents/${doc}`} className="mt-2 inline-block text-sm underline">
          {t("pointPanelOpenDocument")}
        </RouterLink>
      )}
    </div>
  );
}
