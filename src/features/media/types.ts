// src/features/media/types.ts
import type { components } from "@/api/schema";

/** Полная media-запись (GET /api/me/media, GET /api/media/{id}). */
export type Media = components["schemas"]["media.Media"];

/** Лёгкое DTO для picker GET /api/media (в этой фиче не используется, но
 *  экспортируется для симметрии типов). */
export type MediaSummary = components["schemas"]["media.MediaSummary"];

/** "video" | "audio". */
export type FileType = components["schemas"]["media.FileType"];

/** "private" | "public". */
export type Visibility = components["schemas"]["access.Visibility"];

/** Элемент GET /api/media/{id}/attachments — контейнер, к которому привязано медиа. */
export type MediaAttachment = components["schemas"]["attachment.AttachmentDTO"];
