// src/features/media/types.ts
import type { components } from "@/api/schema";

/** Полная media-запись (GET /api/media/{id}, POST /api/media). Несёт url. */
export type Media = components["schemas"]["media.Media"];

/** Облегчённый элемент листинга GET /api/media (любой scope): id/filename/type/
 *  visibility/created_at/owner, БЕЗ подписанного url (за url — getMediaById). Все
 *  поля опциональны по контракту бэка. */
export type MediaListItem = components["schemas"]["media.MediaListItem"];

/** "video" | "audio". */
export type FileType = components["schemas"]["media.FileType"];

/** "private" | "public". */
export type { AccessVisibility as Visibility } from "@/api/types";

/** Элемент GET /api/media/{id}/attachments — контейнер, к которому привязано медиа. */
export type MediaAttachment = components["schemas"]["attachment.AttachmentDTO"];
