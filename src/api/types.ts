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
export type Lecture = Schemas["internal_lecture.Lecture"];
export type LectureCreateRequest = Schemas["internal_lecture.CreateRequest"];
export type LectureUpdateRequest = Schemas["internal_lecture.UpdateRequest"];

// --- Transcript ---
export type Transcript = Schemas["internal_transcript.Transcript"];
export type Segment = Schemas["internal_transcript.Segment"];
export type SegmentCreateRequest = Schemas["internal_transcript.CreateSegmentRequest"];
export type SegmentUpdateRequest = Schemas["internal_transcript.UpdateSegmentRequest"];

// --- Files ---
export type LectureFile = Schemas["internal_lecturefile.LectureFile"];
export type FileType = Schemas["internal_lecturefile.FileType"];

// --- Comments ---
export type Comment = Schemas["internal_comment.Comment"];
export type CommentAuthor = Schemas["internal_comment.Author"];
export type CommentCreateRequest = Schemas["internal_comment.CreateRequest"];
export type CommentUpdateRequest = Schemas["internal_comment.UpdateRequest"];
export type CommentReactionSummary = Schemas["internal_comment.ReactionSummary"];
export type CommentReactionType = Schemas["internal_comment.ReactionType"];
export type CommentAddReactionRequest = Schemas["internal_comment.AddReactionRequest"];

// --- Annotations ---
export type Annotation = Schemas["internal_annotation.Annotation"];
export type AnnotationAuthor = Schemas["internal_annotation.Author"];
export type AnnotationCreateRequest = Schemas["internal_annotation.CreateRequest"];
export type AnnotationUpdateRequest = Schemas["internal_annotation.UpdateRequest"];

// --- Users ---
export type User = Schemas["internal_user.User"];
export type UserRegisterRequest = Schemas["internal_user.RegisterRequest"];
export type UserUpdateStatusRequest = Schemas["internal_user.UpdateStatusRequest"];

// --- Push ---
export type PushSubscribeRequest = Schemas["internal_push.SubscribeRequest"];
export type PushUnsubscribeRequest = Schemas["internal_push.UnsubscribeRequest"];
export type PushSendRequest = Schemas["internal_push.SendRequest"];
export type PushSubscribeKeys = Schemas["internal_push.SubscribeKeys"];

// --- Search ---
export type SearchLectureHit = Schemas["internal_search.LectureHit"];
export type SearchMatch = Schemas["internal_search.Match"];
