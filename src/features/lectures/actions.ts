"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import type { DocumentSummary, MediaSummary } from "@/api/types";
import { getT } from "@/i18n";
import {
  rethrowApiError,
  type ApiErrorMessageKeys,
} from "@/utils/api-error";
import { unwrap } from "@/utils/api-unwrap";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { idempotencyHeaders } from "@/utils/idempotency";
import { getMe } from "@/utils/me";
import { ifMatchHeader } from "@/utils/optimistic-lock";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { getLectureById } from "./api";
import {
  canAttachToLecture,
  canCreateLecture,
  canDeleteLecture,
  canManageAttachments,
  canManageCover,
  canSetLectureVisibility,
  canUpdateLecture,
} from "./permissions";
import {
  makeAttachDocumentIdsSchema,
  makeLectureAttachSchema,
  makeLectureCreateSchema,
  makeLectureCoverClearSchema,
  makeLectureCoverSchema,
  makeLectureDetachSchema,
  makeLectureIdSchema,
  makeLectureReorderSchema,
  makeLectureSuggestSchema,
  makeLectureUpdateSchema,
  makeLectureVisibilitySchema,
} from "./schemas";
import type { Lecture, AttachmentEntityType } from "./types";

/** Доменные коды лекций → ключи каталога errors. role-403 (ATTACH_FORBIDDEN/
 * UPLOAD_FOREIGN/FORBIDDEN), SUSPENDED/BANNED и REF_NOT_FOUND обрабатывает
 * централизованный `rethrowApiError`. */
const ERRORS: ApiErrorMessageKeys = {
  UPLOAD_NOT_FOUND: "UPLOAD_NOT_FOUND",
  ALREADY_ATTACHED: "ALREADY_ATTACHED",
  INVALID_ENTITY_TYPE: "INVALID_ENTITY_TYPE",
  // NOT_FOUND — generic backend code; mapped to entity-specific key so the global
  // catalog stays free of this generic code (otherwise isErrorKey would treat it
  // as a catalog key for every future slice that receives NOT_FOUND).
  NOT_FOUND: "LECTURE_NOT_FOUND",
  LECTURE_NOT_FOUND: "LECTURE_NOT_FOUND",
};

/** Грузит лекцию для owner-aware гейта. 404 → ForbiddenError (secure). */
async function loadLectureForGate(id: string): Promise<Lecture> {
  const lecture = await getLectureById(id);
  if (!lecture) throw new ForbiddenError("owner", "Lecture not found");
  return lecture;
}

/**
 * id готовых документов для прикрепления при создании лекции (Вариант A) из
 * скрытого поля формы `attach_document_ids` (JSON-массив строк). Отсутствует/
 * пустое/битый JSON/не прошло валидацию → [] (форма генерирует поле сама, так
 * что мягкая деградация безопасна — реальная проверка id на шаге attach у бека).
 */
function parseAttachDocumentIds(formData: FormData): string[] {
  const raw = formData.get("attach_document_ids");
  if (typeof raw !== "string" || raw.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const result = makeAttachDocumentIdsSchema().safeParse(parsed);
  return result.success ? result.data : [];
}

export const createLecture = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  // capability-only гейт — ставим ДО парсинга (отказ дешевле без траты на парсинг, §3.3).
  requireCapability(me, canCreateLecture);
  const t = await getT("validation");
  const input = parseFormData(makeLectureCreateSchema(t), formData);
  const attachDocumentIds = parseAttachDocumentIds(formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/lectures", {
    body: {
      title: input.title,
      description: input.description,
      date: input.date,
      ...(input.visibility !== undefined && { visibility: input.visibility }),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.LECTURES);
  const lecture = unwrap(data);

  // Вариант A: best-effort прикрепление выбранных готовых документов сразу после
  // создания (бек без изменений — две существующие ручки). Неатомарно: лекция
  // уже создана, отдельный неудачный attach НЕ валит создание — пользователь
  // до-прикрепит на странице прикреплений (туда форма и редиректит при выборе).
  // Гейт attach = entity.attach ∧ ownership на свежей (owner = me) лекции.
  if (lecture && attachDocumentIds.length > 0 && canAttachToLecture(me, lecture)) {
    // Последовательно: стабильный sort_order и щадящая нагрузка на бек.
    for (const [i, entityId] of attachDocumentIds.entries()) {
      await api.POST("/api/lectures/{lectureID}/attachments", {
        params: { path: { lectureID: lecture.id } },
        body: { entity_id: entityId, entity_type: "document", sort_order: i },
      });
    }
    revalidateEntity(Tags.LECTURES, lecture.id);
  }
  return lecture;
}, "createLecture");

export const updateLecture = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  const t = await getT("validation");
  const input = parseFormData(makeLectureUpdateSchema(t), formData);
  const lecture = await loadLectureForGate(input.id);
  requireCapability(me, (m) => canUpdateLecture(m, lecture));
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/lectures/{id}", {
    params: {
      path: { id: input.id },
      header: ifMatchHeader(formData, "лекции"),
    },
    body: { title: input.title, description: input.description, date: input.date },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.LECTURES, input.id);
  revalidateEntity(Tags.LECTURES);
  return unwrap(data);
}, "updateLecture");

export const setLectureVisibility = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  const t = await getT("validation");
  const input = parseFormData(makeLectureVisibilitySchema(t), formData);
  const lecture = await loadLectureForGate(input.id);
  requireCapability(me, (m) => canSetLectureVisibility(m, lecture));
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/lectures/{id}/visibility", {
    params: { path: { id: input.id } },
    body: { visibility: input.visibility },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.LECTURES, input.id);
  revalidateEntity(Tags.LECTURES);
  return unwrap(data);
}, "setLectureVisibility");

export const deleteLecture = createAction(async (rawId: string) => {
  const me = await getMe();
  // capability-only гейт — ставим ДО парсинга (отказ дешевле без траты на парсинг, §3.3).
  requireCapability(me, canDeleteLecture);
  const t = await getT("validation");
  const { id } = makeLectureIdSchema(t).parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/lectures/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.LECTURES);
  return undefined;
}, "deleteLecture");

/**
 * PUT /api/lectures/{id}/cover — промоут ранее загруженного изображения
 * (upload_id из POST /api/uploads/images) в cover-слот. Owner-only.
 * Бек отдаёт 204 — фронт инвалидирует кеш и перечитывает лекцию.
 */
export const setLectureCover = createAction(
  async (raw: { id: string; upload_id: string; alt_text?: string }) => {
    const me = await getMe();
    const t = await getT("validation");
    const input = makeLectureCoverSchema(t).parse(raw);
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
    if (error) rethrowApiError(error, ERRORS);
    revalidateEntity(Tags.LECTURES, input.id);
    revalidateEntity(Tags.LECTURES);
    return undefined;
  },
  "setLectureCover",
);

/** DELETE /api/lectures/{id}/cover — снять обложку. Owner-only. 204. */
export const clearLectureCover = createAction(async (rawId: string) => {
  const me = await getMe();
  const t = await getT("validation");
  const { id } = makeLectureCoverClearSchema(t).parse({ id: rawId });
  const lecture = await loadLectureForGate(id);
  requireCapability(me, (m) => canManageCover(m, lecture));
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/lectures/{id}/cover", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.LECTURES, id);
  revalidateEntity(Tags.LECTURES);
  return undefined;
}, "clearLectureCover");

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
    const t = await getT("validation");
    const input = makeLectureAttachSchema(t).parse(raw);
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
    if (error) rethrowApiError(error, ERRORS);
    revalidateEntity(Tags.LECTURES, input.lecture_id);
    return undefined;
  },
  "attachToLecture",
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
    const t = await getT("validation");
    const input = makeLectureDetachSchema(t).parse(raw);
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
    if (error) rethrowApiError(error, ERRORS);
    revalidateEntity(Tags.LECTURES, input.lecture_id);
    return undefined;
  },
  "detachFromLecture",
);

/**
 * POST /api/glossary/suggest — найти термины глоссария в блоках текста.
 * requiredAuth (гость → бек 401 → ForbiddenError → forbidden-код; вызывающий
 * деградирует до plain-текста). offset/length в ответе — БАЙТЫ (см.
 * suggest-highlight.ts конверсию). Возвращаем suggestions как есть.
 */
export const suggestGlossaryTerms = createAction(
  async (raw: { blocks: { block_id: string; text: string }[] }, ctx) => {
    const t = await getT("validation");
    const input = makeLectureSuggestSchema(t).parse(raw);
    const api = await createApiClient();
    const { data, error } = await api.POST("/api/glossary/suggest", {
      body: { blocks: input.blocks },
      headers: idempotencyHeaders(ctx.idempotencyKey),
    });
    if (error) rethrowApiError(error, ERRORS);
    return data.data?.suggestions ?? [];
  },
  "suggestGlossaryTerms",
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
    if (error) rethrowApiError(error, ERRORS);
    // data.data уже типизирован схемой как DocumentSummary[] — каст не нужен.
    return {
      data: (data.data ?? [])
        .filter((d): d is DocumentSummary & { id: string } => Boolean(d.id))
        .map((d) => ({ id: d.id, label: d.filename ?? d.id })),
      total: data.pagination?.total ?? null,
    };
  },
  "searchDocumentsForAttach",
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
    if (error) rethrowApiError(error, ERRORS);
    // data.data уже типизирован схемой как MediaSummary[] — каст не нужен.
    return {
      data: (data.data ?? [])
        .filter((m): m is MediaSummary & { id: string } => Boolean(m.id))
        .map((m) => ({ id: m.id, label: m.filename ?? m.id })),
      total: data.pagination?.total ?? null,
    };
  },
  "searchMediaForAttach",
);

/**
 * Поиск форм владельца для attach-пикера. Источник — GET /api/forms?scope=mine
 * (формы текущего пользователя; attach owner-only, прикрепляют свои формы).
 *
 * СТОПГАП: у /api/forms есть scope/owner_id/offset/limit, но НЕТ серверного `q`
 * (в отличие от /api/documents и /api/media). q-фильтр обязан быть клиентским, а
 * раз так — серверная пагинация неприменима к отфильтрованному набору, поэтому
 * тянем весь (ограниченный) список форм владельца, фильтруем по label подстрокой
 * и режем offset/limit здесь. Когда бэк добавит `q` форм — заменить на серверный
 * поиск с пагинацией.
 */
export const searchFormsForAttach = createAction(
  async (raw: { q: string; offset: number; limit: number }) => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/forms", {
      params: { query: { scope: "mine" } },
    });
    if (error) rethrowApiError(error, ERRORS);
    const all = (data.data ?? [])
      .filter((f): f is typeof f & { id: string } => Boolean(f.id))
      .map((f) => ({ id: f.id, label: f.title ?? f.id }));
    const q = raw.q.trim().toLowerCase();
    const filtered = q
      ? all.filter((f) => f.label.toLowerCase().includes(q))
      : all;
    return {
      data: filtered.slice(raw.offset, raw.offset + raw.limit),
      total: filtered.length,
    };
  },
  "searchFormsForAttach",
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
    const t = await getT("validation");
    const input = makeLectureReorderSchema(t).parse(raw);
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
    if (error) rethrowApiError(error, ERRORS);
    revalidateEntity(Tags.LECTURES, input.lecture_id);
    return undefined;
  },
  "reorderLectureAttachment",
);
