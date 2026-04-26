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

// --- Push ---
export type PushSubscribeRequest = Schemas["push.SubscribeRequest"];
export type PushUnsubscribeRequest = Schemas["push.UnsubscribeRequest"];
export type PushSendRequest = Schemas["push.SendRequest"];
export type PushSubscribeKeys = Schemas["push.SubscribeKeys"];

// --- Search ---
export type SearchMatch = Schemas["search.Match"];
