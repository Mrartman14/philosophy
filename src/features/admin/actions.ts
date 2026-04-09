"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createApiClient } from "@/api/client";
import type {
  LectureCreateRequest,
  LectureUpdateRequest,
  ModerationStatus,
  SegmentCreateRequest,
  SegmentUpdateRequest,
  UserUpdateStatusRequest,
  PushSendRequest,
} from "@/api/types";
import { createAction, createFormAction } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { requireCapability } from "@/utils/permissions";
import {
  canModerateAnnotations,
  canModerateComments,
  canModerateUsers,
  canSendPush,
} from "./permissions";
import {
  canCreateLecture,
  canDeleteLecture,
  canUpdateLecture,
  canUploadLectureFiles,
} from "@/features/lectures/permissions";
import { canEditTranscript } from "@/features/transcript/permissions";

type UserStatus = UserUpdateStatusRequest["status"];

/* -------------------------------------------------------------------------- */
/*  Лекции                                                                    */
/* -------------------------------------------------------------------------- */

export const createLecture = createFormAction<{ id: string }>(
  async (formData: FormData) => {
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const date = String(formData.get("date") ?? "").trim();

    if (!title || !date) {
      throw new Error("Укажите название и дату");
    }

    const me = await getMe();
    requireCapability(me, canCreateLecture);

    const body: LectureCreateRequest = { title, date };
    if (description) body.description = description;

    const client = await createApiClient();
    const { data, error } = await client.POST("/api/admin/lectures", { body });
    if (error || !data?.data?.id) {
      throw new Error("Не удалось создать лекцию");
    }

    revalidatePath("/admin/lectures");
    revalidatePath("/lectures");
    redirect(`/admin/lectures/${data.data.id}`);
  }
);

export const updateLecture = createFormAction<void>(
  async (formData: FormData) => {
    const id = String(formData.get("id") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const date = String(formData.get("date") ?? "").trim();

    if (!id) throw new Error("ID лекции не указан");

    const me = await getMe();
    requireCapability(me, canUpdateLecture);

    const body: LectureUpdateRequest = {};
    if (title) body.title = title;
    if (description) body.description = description;
    if (date) body.date = date;

    const client = await createApiClient();
    const { error } = await client.PUT("/api/admin/lectures/{id}", {
      params: { path: { id } },
      body,
    });
    if (error) throw new Error("Не удалось сохранить лекцию");

    revalidatePath("/admin/lectures");
    revalidatePath(`/admin/lectures/${id}`);
    revalidatePath(`/lectures/${id}`);
  }
);

export const deleteLecture = createAction<{ id: string }, void>(
  async ({ id }) => {
    const me = await getMe();
    requireCapability(me, canDeleteLecture);

    const client = await createApiClient();
    const { error } = await client.DELETE("/api/admin/lectures/{id}", {
      params: { path: { id } },
    });
    if (error) throw new Error("Не удалось удалить лекцию");

    revalidatePath("/admin/lectures");
    revalidatePath("/lectures");
  }
);

/* -------------------------------------------------------------------------- */
/*  Транскрипт                                                                */
/* -------------------------------------------------------------------------- */

export const addSegment = createAction<
  {
    lectureId: string;
    position: number;
    start: number;
    end: number;
    speaker: string;
    text: string;
  },
  void
>(async ({ lectureId, position, start, end, speaker, text }) => {
  const me = await getMe();
  requireCapability(me, canEditTranscript);

  const body: SegmentCreateRequest = {
    position,
    start,
    end,
    speaker,
    text,
  };

  const client = await createApiClient();
  const { error } = await client.POST(
    "/api/admin/lectures/{id}/transcript/segments",
    {
      params: { path: { id: lectureId } },
      body,
    }
  );
  if (error) throw new Error("Не удалось добавить сегмент");

  revalidatePath(`/admin/lectures/${lectureId}`);
  revalidatePath(`/lectures/${lectureId}`);
});

export const updateSegment = createAction<
  {
    lectureId: string;
    segmentId: string;
    position?: number;
    start?: number;
    end?: number;
    speaker?: string;
    text?: string;
  },
  void
>(async ({ lectureId, segmentId, position, start, end, speaker, text }) => {
  const me = await getMe();
  requireCapability(me, canEditTranscript);

  const body: SegmentUpdateRequest = {};
  if (position !== undefined) body.position = position;
  if (start !== undefined) body.start = start;
  if (end !== undefined) body.end = end;
  if (speaker !== undefined) body.speaker = speaker;
  if (text !== undefined) body.text = text;

  const client = await createApiClient();
  const { error } = await client.PUT(
    "/api/admin/lectures/{id}/transcript/segments/{segmentId}",
    {
      params: { path: { id: lectureId, segmentId } },
      body,
    }
  );
  if (error) throw new Error("Не удалось обновить сегмент");

  revalidatePath(`/admin/lectures/${lectureId}`);
  revalidatePath(`/lectures/${lectureId}`);
});

export const deleteSegment = createAction<
  { lectureId: string; segmentId: string },
  void
>(async ({ lectureId, segmentId }) => {
  const me = await getMe();
  requireCapability(me, canEditTranscript);

  const client = await createApiClient();
  const { error } = await client.DELETE(
    "/api/admin/lectures/{id}/transcript/segments/{segmentId}",
    {
      params: { path: { id: lectureId, segmentId } },
    }
  );
  if (error) throw new Error("Не удалось удалить сегмент");

  revalidatePath(`/admin/lectures/${lectureId}`);
  revalidatePath(`/lectures/${lectureId}`);
});

/* -------------------------------------------------------------------------- */
/*  Файлы                                                                      */
/* -------------------------------------------------------------------------- */

export const uploadFile = createFormAction<void>(
  async (formData: FormData) => {
    const me = await getMe();
    requireCapability(me, canUploadLectureFiles);

    const lectureId = String(formData.get("lectureId") ?? "");
    if (!lectureId) throw new Error("ID лекции не указан");

    // Оставляем в форме только type и file — бэк ждёт именно их.
    const upload = new FormData();
    const type = String(formData.get("type") ?? "");
    const file = formData.get("file");
    if (!type) throw new Error("Укажите тип файла");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Выберите файл");
    }
    upload.set("type", type);
    upload.set("file", file);

    // createApiClient() обычно ставит Content-Type: application/json;
    // для multipart используем FormData напрямую, а токен добавляем сами.
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const API_URL = process.env.API_URL ?? "http://localhost:8080";

    const response = await fetch(
      `${API_URL}/api/admin/lectures/${encodeURIComponent(lectureId)}/files`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: upload,
      }
    );

    if (!response.ok) {
      throw new Error(`Не удалось загрузить файл (${response.status})`);
    }

    revalidatePath(`/admin/lectures/${lectureId}`);
    revalidatePath(`/lectures/${lectureId}`);
  }
);

export const deleteFile = createAction<
  { lectureId: string; fileId: string },
  void
>(async ({ lectureId, fileId }) => {
  const me = await getMe();
  requireCapability(me, canUploadLectureFiles);

  const client = await createApiClient();
  const { error } = await client.DELETE(
    "/api/admin/lectures/{id}/files/{fileId}",
    {
      params: { path: { id: lectureId, fileId } },
    }
  );
  if (error) throw new Error("Не удалось удалить файл");

  revalidatePath(`/admin/lectures/${lectureId}`);
  revalidatePath(`/lectures/${lectureId}`);
});

/* -------------------------------------------------------------------------- */
/*  Пользователи                                                               */
/* -------------------------------------------------------------------------- */

export const updateUserStatus = createAction<
  { userId: string; status: UserStatus },
  void
>(async ({ userId, status }) => {
  const me = await getMe();
  requireCapability(me, canModerateUsers);

  const client = await createApiClient();
  const { error } = await client.PUT("/api/admin/users/{id}/status", {
    params: { path: { id: userId } },
    body: { status },
  });
  if (error) throw new Error("Не удалось изменить статус пользователя");

  revalidatePath("/admin/users");
});

/* -------------------------------------------------------------------------- */
/*  Модерация комментариев                                                     */
/* -------------------------------------------------------------------------- */

export const deleteCommentAdmin = createAction<
  { commentId: string; lectureId?: string },
  void
>(async ({ commentId, lectureId }) => {
  const me = await getMe();
  requireCapability(me, canModerateComments);

  const client = await createApiClient();
  const { error } = await client.DELETE("/api/admin/comments/{id}", {
    params: { path: { id: commentId } },
  });
  if (error) throw new Error("Не удалось удалить комментарий");

  revalidatePath("/admin/comments");
  if (lectureId) revalidatePath(`/lectures/${lectureId}`);
});

export const updateCommentStatus = createAction<
  { commentId: string; status: ModerationStatus; lectureId?: string },
  void
>(async ({ commentId, status, lectureId }) => {
  const me = await getMe();
  requireCapability(me, canModerateComments);

  const client = await createApiClient();
  const { error } = await client.PUT("/api/admin/comments/{id}/status", {
    params: { path: { id: commentId } },
    body: { status },
  });
  if (error) throw new Error("Не удалось изменить статус комментария");

  revalidatePath("/admin/comments");
  if (lectureId) revalidatePath(`/lectures/${lectureId}`);
});

/* -------------------------------------------------------------------------- */
/*  Модерация аннотаций                                                        */
/* -------------------------------------------------------------------------- */

export const deleteAnnotationAdmin = createAction<
  { annotationId: string; lectureId?: string },
  void
>(async ({ annotationId, lectureId }) => {
  const me = await getMe();
  requireCapability(me, canModerateAnnotations);

  const client = await createApiClient();
  const { error } = await client.DELETE("/api/admin/annotations/{id}", {
    params: { path: { id: annotationId } },
  });
  if (error) throw new Error("Не удалось удалить аннотацию");

  revalidatePath("/admin/annotations");
  if (lectureId) revalidatePath(`/lectures/${lectureId}`);
});

export const updateAnnotationStatus = createAction<
  { annotationId: string; status: ModerationStatus; lectureId?: string },
  void
>(async ({ annotationId, status, lectureId }) => {
  const me = await getMe();
  requireCapability(me, canModerateAnnotations);

  const client = await createApiClient();
  const { error } = await client.PUT("/api/admin/annotations/{id}/status", {
    params: { path: { id: annotationId } },
    body: { status },
  });
  if (error) throw new Error("Не удалось изменить статус аннотации");

  revalidatePath("/admin/annotations");
  if (lectureId) revalidatePath(`/lectures/${lectureId}`);
});

/* -------------------------------------------------------------------------- */
/*  Push                                                                       */
/* -------------------------------------------------------------------------- */

export const sendPush = createFormAction<void>(async (formData: FormData) => {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();

  if (!title) throw new Error("Укажите заголовок уведомления");

  const me = await getMe();
  requireCapability(me, canSendPush);

  const payload: PushSendRequest = { title };
  if (body) payload.body = body;
  if (url) payload.url = url;

  const client = await createApiClient();
  const { error } = await client.POST("/api/admin/push/send", {
    body: payload,
  });
  if (error) throw new Error("Не удалось отправить push-уведомление");
});
