/**
 * Плоские реэкспорты всех схем из `schema.ts`.
 *
 * Используй вместо `components["schemas"]["..."]`.
 *   import type { Lecture, Comment, Annotation } from "@/api/types";
 *
 * Файл поддерживается вручную. После обновления `schema.ts` (через `npm run generate:api`)
 * проверь, что здесь реэкспортированы все нужные схемы.
 */

import type { components } from "./schema";

type Schemas = components["schemas"];

// --- Common ---
/** Видимость ресурса (`access.Visibility`): "private" | "public". Единый
 * источник для слайсов вместо локальных дублей `type Visibility`. */
export type AccessVisibility = Schemas["access.Visibility"];

/** Общая форма списочного ответа бека (httputil.ListResponse + UI-проекция). */
export interface ApiList<T> {
  data: T[];
  pagination: { offset: number; limit: number; total: number };
}

/** Машиночитаемые коды ошибок бека (`apperror.Code`, UPPER_SNAKE_CASE).
 * Единственный источник истины — const-блок `internal/apperror/codes.go`,
 * проброшен через swaggo enum → OpenAPI → `schema.ts`. Типизирует `code`
 * в `switch` слайсов: автокомплит + детект дрифта при regen схемы. */
export type ApiErrorCode = Schemas["apperror.Code"];

// --- Lectures ---
export type Lecture = Schemas["lecture.Lecture"];
export type LectureCreateRequest = Schemas["lecture.CreateRequest"];
export type LectureUpdateRequest = Schemas["lecture.UpdateRequest"];

// --- Comments ---
export type Comment = Schemas["comment.Comment"];
export type CommentAuthor = Schemas["comment.Author"];
export type CommentCreateRequest = Schemas["comment.CreateRequest"];
export type CommentUpdateRequest = Schemas["comment.UpdateRequest"];
export type CommentReactionSummary = Schemas["comment.ReactionSummary"];

// --- Annotations ---
export type Annotation = Schemas["annotation.Annotation"];
export type AnnotationCreateRequest = Schemas["annotation.CreateRequest"];
export type AnnotationUpdateRequest = Schemas["annotation.UpdateRequest"];

// --- Users ---
export type User = Schemas["user.User"];
export type UserRegisterRequest = Schemas["user.RegisterRequest"];
export type UserUpdateStatusRequest = Schemas["user.UpdateStatusRequest"];
export type UserStatus = UserUpdateStatusRequest["status"];

// --- RBAC ---
/** Полный реестр capability (генерируется из rbac.Capability). */
export type Capability = Schemas["rbac.Capability"];

// --- Push ---
export type PushSubscribeRequest = Schemas["push.SubscribeRequest"];
export type PushUnsubscribeRequest = Schemas["push.UnsubscribeRequest"];
export type PushSendRequest = Schemas["push.SendRequest"];
export type PushSubscribeKeys = Schemas["push.SubscribeKeys"];

// --- Uploads ---
/** Тело 201 POST /api/uploads/images: { upload_id, storage_key }. */
export type UploadImageResponse = Schemas["image.UploadImageResponse"];

// --- Documents / Media (списочные проекции для пикеров) ---
export type DocumentSummary = Schemas["document.DocumentSummary"];
export type MediaSummary = Schemas["media.MediaSummary"];
