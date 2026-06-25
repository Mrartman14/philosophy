// src/features/share-links/client.ts
// Публичный CLIENT-safe entry слайса share-links — для импорта из "use client"-кода
// (напр. lecture-actions-menu). Только client UI, чистые утилиты, типы. ЗАПРЕЩЕНО
// реэкспортировать ./api / ./actions / ./permissions / ./schemas (server-only): их
// утечка в client-бандл тянет @/i18n → next/headers (Guardrail 4).
export { ShareButton } from "./ui/share-button";
export { ShareDialog } from "./ui/share-dialog";
export { ShareLinkList } from "./ui/share-link-list";
export { ShareLookupForm } from "./ui/share-lookup-form";
export { buildShareUrl } from "./share-url";
export {
  type ShareLink,
  type ResourceType,
  SHARE_RESOURCE_TYPES,
  ALL_RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
} from "./types";
