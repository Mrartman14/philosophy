"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { handleCommonApiError, type ApiError } from "@/utils/api-error";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import { getLectureById } from "./api";
import {
  canAttachToLecture,
  canCreateLecture,
  canDeleteLecture,
  canManageAttachments,
  canManageCover,
} from "./permissions";
import {
  LectureAttachSchema,
  LectureCreateSchema,
  LectureCoverClearSchema,
  LectureCoverSchema,
  LectureDetachSchema,
  LectureIdSchema,
  LectureReorderSchema,
  LectureSuggestSchema,
  LectureUpdateSchema,
  LectureVisibilitySchema,
} from "./schemas";
import type { Lecture, AttachmentEntityType } from "./types";

function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    // Доменные 403-коды лекций; общий "FORBIDDEN" ловит handleCommonApiError.
    case "ATTACH_FORBIDDEN":
    case "UPLOAD_FOREIGN":
      throw new ForbiddenError("role", err.error);
    // Свой текст-fallback (общий хелпер дал бы "Аккаунт ограничен.").
    case "SUSPENDED":
      throw new ForbiddenError("status", err.error);
    case "UPLOAD_NOT_FOUND":
      throw new Error("Загруженное изображение не найдено. Попробуйте ещё раз.");
    case "ALREADY_ATTACHED":
      throw new Error("Эта сущность уже прикреплена к лекции.");
    case "INVALID_ENTITY_TYPE":
      throw new Error("Недопустимый тип сущности.");
    case "NOT_FOUND":
    case "LECTURE_NOT_FOUND":
      throw new Error("Лекция не найдена.");
  }
  handleCommonApiError(err);
}

/** Грузит лекцию для owner-aware гейта. 404 → ForbiddenError (secure). */
async function loadLectureForGate(id: string): Promise<Lecture> {
  const lecture = await getLectureById(id);
  if (!lecture) throw new ForbiddenError("owner", "Лекция не найдена");
  return lecture;
}

export const createLecture = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(LectureCreateSchema, formData);
  requireCapability(me, canCreateLecture);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/lectures", {
    body: {
      title: input.title,
      description: input.description,
      date: input.date,
      ...(input.visibility !== undefined && { visibility: input.visibility }),
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.LECTURES);
  return (data?.data ?? null) as Lecture | null;
});

export const updateLecture = createFormAction(async (formData) => {
  const input = parseFormData(LectureUpdateSchema, formData);
  // Owner-чек делает бэк (см. spec §8). Маппим 403/404 → ForbiddenError/Error.
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/lectures/{id}", {
    params: { path: { id: input.id } },
    body: { title: input.title, description: input.description, date: input.date },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.LECTURES, input.id);
  revalidateEntity(Tags.LECTURES);
  return (data?.data ?? null) as Lecture | null;
});

export const setLectureVisibility = createFormAction(async (formData) => {
  const input = parseFormData(LectureVisibilitySchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/lectures/{id}/visibility", {
    params: { path: { id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.LECTURES, input.id);
  revalidateEntity(Tags.LECTURES);
  return (data?.data ?? null) as Lecture | null;
});

export const deleteLecture = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = LectureIdSchema.parse({ id: rawId });
  requireCapability(me, canDeleteLecture);
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/lectures/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.LECTURES);
  return undefined;
});

/**
 * PUT /api/lectures/{id}/cover — промоут ранее загруженного изображения
 * (upload_id из POST /api/uploads/images) в cover-слот. Owner-only.
 * Бек отдаёт 204 — фронт инвалидирует кеш и перечитывает лекцию.
 */
export const setLectureCover = createAction(
  async (raw: { id: string; upload_id: string; alt_text?: string }) => {
    const me = await getMe();
    const input = LectureCoverSchema.parse(raw);
    const lecture = await loadLectureForGate(input.id);
    requireCapability(me, (m) => canManageCover(m, lecture));
    const api = await createApiClient();
    const { error } = await api.PUT("/api/lectures/{id}/cover", {
      params: { path: { id: input.id } },
      body: {
        upload_id: input.upload_id,
        ...(input.alt_text !== undefined && { alt_text: input.alt_text }),
      },
    });
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity(Tags.LECTURES, input.id);
    revalidateEntity(Tags.LECTURES);
    return undefined;
  },
);

/** DELETE /api/lectures/{id}/cover — снять обложку. Owner-only. 204. */
export const clearLectureCover = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = LectureCoverClearSchema.parse({ id: rawId });
  const lecture = await loadLectureForGate(id);
  requireCapability(me, (m) => canManageCover(m, lecture));
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/lectures/{id}/cover", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.LECTURES, id);
  revalidateEntity(Tags.LECTURES);
  return undefined;
});

/**
 * POST /api/lectures/{lectureID}/attachments — прикрепить document|media|canvas.
 * Гейт: entity.attach ∧ ownership (§6.3). 201 → AttachmentDTO (нам не нужен, void).
 */
export const attachToLecture = createAction(
  async (raw: {
    lecture_id: string;
    entity_id: string;
    entity_type: AttachmentEntityType;
    sort_order?: number;
  }) => {
    const me = await getMe();
    const input = LectureAttachSchema.parse(raw);
    const lecture = await loadLectureForGate(input.lecture_id);
    requireCapability(me, (m) => canAttachToLecture(m, lecture));
    const api = await createApiClient();
    const { error } = await api.POST("/api/lectures/{lectureID}/attachments", {
      params: { path: { lectureID: input.lecture_id } },
      body: {
        entity_id: input.entity_id,
        entity_type: input.entity_type,
        ...(input.sort_order !== undefined && { sort_order: input.sort_order }),
      },
    });
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity(Tags.LECTURES, input.lecture_id);
    return undefined;
  },
);

/**
 * DELETE /api/lectures/{lectureID}/attachments/{entityType}/{entityID}.
 * Гейт: ownership лекции (без capability). 204.
 */
export const detachFromLecture = createAction(
  async (raw: {
    lecture_id: string;
    entity_id: string;
    entity_type: AttachmentEntityType;
  }) => {
    const me = await getMe();
    const input = LectureDetachSchema.parse(raw);
    const lecture = await loadLectureForGate(input.lecture_id);
    requireCapability(me, (m) => canManageAttachments(m, lecture));
    const api = await createApiClient();
    const { error } = await api.DELETE(
      "/api/lectures/{lectureID}/attachments/{entityType}/{entityID}",
      {
        params: {
          path: {
            lectureID: input.lecture_id,
            entityType: input.entity_type,
            entityID: input.entity_id,
          },
        },
      },
    );
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity(Tags.LECTURES, input.lecture_id);
    return undefined;
  },
);

/**
 * POST /api/glossary/suggest — найти термины глоссария в блоках текста.
 * requiredAuth (гость → бек 401 → ForbiddenError → forbidden-код; вызывающий
 * деградирует до plain-текста). offset/length в ответе — БАЙТЫ (см.
 * suggest-highlight.ts конверсию). Возвращаем suggestions как есть.
 */
export const suggestGlossaryTerms = createAction(
  async (raw: { blocks: { block_id: string; text: string }[] }) => {
    const input = LectureSuggestSchema.parse(raw);
    const api = await createApiClient();
    const { data, error } = await api.POST("/api/glossary/suggest", {
      body: { blocks: input.blocks },
    });
    if (error) rethrowApiError(error as ApiError);
    return data?.data?.suggestions ?? [];
  },
);

/**
 * Поиск документов для attach-пикера (GET /api/documents — picker, requiredAuth).
 * Возвращает {data:[{id,label}], total}. Прямой вызов API (НЕ cross-feature
 * импорт слайса documents — слайс lectures зовёт публичный API напрямую).
 */
export const searchDocumentsForAttach = createAction(
  async (raw: { q: string; offset: number; limit: number }) => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/documents", {
      params: {
        query: {
          offset: raw.offset,
          limit: raw.limit,
          ...(raw.q ? { q: raw.q } : {}),
        },
      },
    });
    if (error) throw new Error(error.error ?? "Ошибка поиска документов");
    const items = (data?.data ?? []) as { id?: string; filename?: string }[];
    return {
      data: items
        .filter((d): d is { id: string; filename?: string } => Boolean(d.id))
        .map((d) => ({ id: d.id, label: d.filename ?? d.id })),
      total: data?.pagination?.total ?? null,
    };
  },
);

/** Поиск медиа для attach-пикера (GET /api/media — picker, requiredAuth). */
export const searchMediaForAttach = createAction(
  async (raw: { q: string; offset: number; limit: number }) => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/media", {
      params: {
        query: {
          offset: raw.offset,
          limit: raw.limit,
          ...(raw.q ? { q: raw.q } : {}),
        },
      },
    });
    if (error) throw new Error(error.error ?? "Ошибка поиска медиа");
    const items = (data?.data ?? []) as { id?: string; filename?: string }[];
    return {
      data: items
        .filter((m): m is { id: string; filename?: string } => Boolean(m.id))
        .map((m) => ({ id: m.id, label: m.filename ?? m.id })),
      total: data?.pagination?.total ?? null,
    };
  },
);

/**
 * PATCH /api/lectures/{lectureID}/attachments/{entityType}/{entityID}.
 * Абсолютный sort_order (не swap, бек клампит). Гейт: ownership. 204.
 */
export const reorderLectureAttachment = createAction(
  async (raw: {
    lecture_id: string;
    entity_id: string;
    entity_type: AttachmentEntityType;
    sort_order: number;
  }) => {
    const me = await getMe();
    const input = LectureReorderSchema.parse(raw);
    const lecture = await loadLectureForGate(input.lecture_id);
    requireCapability(me, (m) => canManageAttachments(m, lecture));
    const api = await createApiClient();
    const { error } = await api.PATCH(
      "/api/lectures/{lectureID}/attachments/{entityType}/{entityID}",
      {
        params: {
          path: {
            lectureID: input.lecture_id,
            entityType: input.entity_type,
            entityID: input.entity_id,
          },
        },
        body: { sort_order: input.sort_order },
      },
    );
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity(Tags.LECTURES, input.lecture_id);
    return undefined;
  },
);
