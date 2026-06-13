// src/features/forms/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireActive } from "@/utils/permissions";
import { handleCommonApiError, type ApiError } from "@/utils/api-error";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import { canCreateForm } from "./permissions";
import {
  FormCreateSchema,
  FormUpdateSchema,
  FormVisibilitySchema,
  FormIdSchema,
  SubmitSchema,
  SubmissionEditSchema,
  SubmissionIdSchema,
} from "./schemas";
import type { Form, SubmitResponse } from "./types";

/** UPPER_SNAKE_CASE коды бека → понятный русский (internal/apperror, form/service.go). */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "FORM_PUBLISHED":
      throw new Error("Форма опубликована — её структуру нельзя менять.");
    case "PUBLIC_IMMUTABLE":
      throw new Error("Публичную форму нельзя вернуть в приватную.");
    case "MODE_CHANGE_FORBIDDEN":
      throw new Error("Режим «без изменений» нельзя сменить на «редактируемый».");
    case "FORM_IMMUTABLE_MODE":
      throw new Error("Эта форма не разрешает редактировать или удалять отклик — только отозвать.");
    case "RETRACT_NOT_APPLICABLE":
      throw new Error("Отзыв доступен только в формах без редактирования отклика.");
    case "ALREADY_SUBMITTED":
      throw new Error("Вы уже отправляли отклик на эту форму.");
    case "ALREADY_RETRACTED":
      throw new Error("Отклик уже отозван.");
    case "INVALID_FORM_SCHEMA":
      throw new Error("Структура формы не прошла проверку на сервере.");
    case "INVALID_SUBMISSION":
      throw new Error("Ответы не прошли проверку. Заполните обязательные поля корректно.");
    case "BLOCKS_INVALID":
    case "REF_NOT_FOUND":
      throw new Error("Описание формы не прошло валидацию.");
    case "FORM_NOT_FOUND":
      throw new Error("Форма не найдена.");
    case "SUBMISSION_NOT_FOUND":
      throw new Error("Отклик не найден.");
  }
  handleCommonApiError(err);
}

/** Собирает тело CreateFormRequest из payload (опускает undefined-ключи: exactOptionalPropertyTypes). */
function buildFieldsBody(
  fields: {
    type: string;
    prompt: string;
    help_text?: string | undefined;
    required: boolean;
    sort_order: number;
    options?: string[] | undefined;
  }[],
) {
  return fields.map((f) => ({
    type: f.type,
    prompt: f.prompt,
    required: f.required,
    sort_order: f.sort_order,
    ...(f.help_text ? { help_text: f.help_text } : {}),
    ...(f.options ? { options: f.options.map((label) => ({ label })) } : {}),
  }));
}

/** POST /api/forms. Гейт — form.create. */
export const createForm = createFormAction(async (formData) => {
  const me = await getMe();
  if (!canCreateForm(me)) throw new ForbiddenError(me ? (me.status !== "active" ? "status" : "role") : "guest");
  const input = parseFormData(FormCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/forms", {
    body: {
      title: input.title,
      fields: buildFieldsBody(input.fields) as never,
      // visibility/submission_mode гарантированы superRefine FormCreateSchema;
      // спред исключает явный undefined-ключ (exactOptionalPropertyTypes).
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.submission_mode ? { submission_mode: input.submission_mode } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.after_submit ? { after_submit: input.after_submit } : {}),
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.FORMS);
  return (data?.data ?? null) as Form | null;
});

/** PATCH /api/forms/{id} — замена структуры. Owner-only + не опубликована (enforce бек). */
export const updateForm = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(FormUpdateSchema, formData);
  const { payload } = input;
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/forms/{id}", {
    params: { path: { id: input.id } },
    body: {
      title: payload.title,
      fields: buildFieldsBody(payload.fields) as never,
      // description/after_submit: пустая строка = очистить (бек: nil=unchanged, ""=clear).
      // Передаём всегда (даже ""), чтобы изменения вступали.
      description: payload.description ?? "",
      after_submit: payload.after_submit ?? "",
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.FORMS, input.id);
  revalidateEntity(Tags.FORMS);
  return (data?.data ?? null) as Form | null;
});

/** PATCH /api/forms/{id} visibility-only → publish (private→public). */
export const publishForm = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(FormVisibilitySchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/forms/{id}", {
    params: { path: { id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.FORMS, input.id);
  revalidateEntity(Tags.FORMS);
  return (data?.data ?? null) as Form | null;
});

/** DELETE /api/forms/{id}. Owner или delete_any(public) — enforce бек. */
export const deleteForm = createAction(async (rawId: string) => {
  const me = await getMe();
  requireActive(me);
  const { id } = FormIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/forms/{id}", { params: { path: { id } } });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.FORMS);
  return undefined;
});

/** POST /api/forms/{id}/submissions. token — для приватной формы (share-link). */
export const submitForm = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(SubmitSchema, formData);
  const api = await createApiClient();
  const query: { token?: string } = {};
  if (input.token) query.token = input.token;
  const { data, error } = await api.POST("/api/forms/{id}/submissions", {
    params: { path: { id: input.formId }, query },
    body: { answers: input.answers as never },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.SUBMISSIONS);
  revalidateEntity(Tags.FORMS, input.formId);
  return (data?.data ?? null) as SubmitResponse | null;
});

/** PATCH /api/submissions/{id} (editable). Автор — enforce бек. */
export const editSubmission = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(SubmissionEditSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/submissions/{id}", {
    params: { path: { id: input.id } },
    body: { answers: input.answers as never },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.SUBMISSIONS, input.id);
  revalidateEntity(Tags.SUBMISSIONS);
  return (data?.data ?? null) as SubmitResponse | null;
});

/** DELETE /api/submissions/{id} (editable, освобождает слот). */
export const deleteSubmission = createAction(async (rawId: string) => {
  const me = await getMe();
  requireActive(me);
  const { id } = SubmissionIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/submissions/{id}", { params: { path: { id } } });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.SUBMISSIONS);
  return undefined;
});

/** POST /api/submissions/{id}/retract (immutable, сжигает слот). */
export const retractSubmission = createAction(async (rawId: string) => {
  const me = await getMe();
  requireActive(me);
  const { id } = SubmissionIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.POST("/api/submissions/{id}/retract", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.SUBMISSIONS, id);
  revalidateEntity(Tags.SUBMISSIONS);
  return undefined;
});
