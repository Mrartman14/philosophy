// src/features/forms/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { Tags } from "@/api/tags";
import { getT } from "@/i18n";
import { rethrowApiError, type ApiErrorMessageKeys } from "@/utils/api-error";
import { unwrap } from "@/utils/api-unwrap";
import {
  ApiMessageError,
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { idempotencyHeaders } from "@/utils/idempotency";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireActive } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { canCreateForm } from "./permissions";
import {
  makeFormCreateSchema,
  makeFormUpdateSchema,
  makeFormVisibilitySchema,
  makeSubmitSchema,
  makeSubmissionEditSchema,
  FormIdSchema,
  SubmissionIdSchema,
} from "./schemas";


/** Доменные коды бека → ключ каталога errors (src/i18n/messages/{ru,en}/errors.ts).
 * role-403/SUSPENDED/BANNED и дефолтный REF_NOT_FOUND обрабатывает
 * централизованный rethrowApiError. */
const ERRORS: ApiErrorMessageKeys = {
  FORM_PUBLISHED: "FORM_PUBLISHED",
  PUBLIC_IMMUTABLE: "FORM_PUBLIC_IMMUTABLE",
  MODE_CHANGE_FORBIDDEN: "MODE_CHANGE_FORBIDDEN",
  FORM_IMMUTABLE_MODE: "FORM_IMMUTABLE_MODE",
  RETRACT_NOT_APPLICABLE: "RETRACT_NOT_APPLICABLE",
  ALREADY_SUBMITTED: "ALREADY_SUBMITTED",
  ALREADY_RETRACTED: "ALREADY_RETRACTED",
  INVALID_FORM_SCHEMA: "INVALID_FORM_SCHEMA",
  INVALID_SUBMISSION: "INVALID_SUBMISSION",
  BLOCKS_INVALID: "FORM_BLOCKS_INVALID",
  FORM_NOT_FOUND: "FORM_NOT_FOUND",
  SUBMISSION_NOT_FOUND: "SUBMISSION_NOT_FOUND",
};

type FieldType = components["schemas"]["form.FieldType"];
type CreateFieldRequest = components["schemas"]["form.CreateFieldRequest"];

/** Собирает тело CreateFormRequest из payload (опускает undefined-ключи: exactOptionalPropertyTypes). */
function buildFieldsBody(
  fields: {
    type: FieldType;
    prompt: string;
    help_text?: string | undefined;
    required: boolean;
    sort_order: number;
    options?: string[] | undefined;
  }[],
): CreateFieldRequest[] {
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
export const createForm = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  if (!canCreateForm(me)) throw new ForbiddenError(me ? (me.status !== "active" ? "status" : "role") : "guest");
  const input = parseFormData(makeFormCreateSchema(await getT("validation")), formData);
  // submission_mode/visibility гарантированы superRefine FormCreateSchema
  // (иначе parseFormData бросит 422 до сюда). Явная проверка инварианта вместо
  // фиктивного дефолта: ломаемся громко, если гарантия когда-нибудь ослабнет.
  // ApiMessageError даёт клиенту локализованное «Ошибка сервера» и при этом
  // ловится createFormAction (observability capture сохраняется).
  if (!input.submission_mode || !input.visibility) {
    throw new ApiMessageError("serverError");
  }
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/forms", {
    body: {
      title: input.title,
      fields: buildFieldsBody(input.fields),
      submission_mode: input.submission_mode,
      visibility: input.visibility,
      ...(input.description ? { description: input.description } : {}),
      ...(input.after_submit ? { after_submit: input.after_submit } : {}),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.FORMS);
  return unwrap(data);
}, "createForm");

/** PATCH /api/forms/{id} — замена структуры. Owner-only + не опубликована (enforce бек). */
export const updateForm = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(makeFormUpdateSchema(await getT("validation")), formData);
  const { payload } = input;
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/forms/{id}", {
    params: { path: { id: input.id } },
    body: {
      title: payload.title,
      fields: buildFieldsBody(payload.fields),
      // description/after_submit: пустая строка = очистить (бек: nil=unchanged, ""=clear).
      // Передаём всегда (даже ""), чтобы изменения вступали.
      description: payload.description ?? "",
      after_submit: payload.after_submit ?? "",
    },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.FORMS, input.id);
  revalidateEntity(Tags.FORMS);
  return unwrap(data);
}, "updateForm");

/** PATCH /api/forms/{id} visibility-only → publish (private→public). */
export const publishForm = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(makeFormVisibilitySchema(await getT("validation")), formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/forms/{id}", {
    params: { path: { id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.FORMS, input.id);
  revalidateEntity(Tags.FORMS);
  return unwrap(data);
}, "publishForm");

/** DELETE /api/forms/{id}. Owner или delete_any(public) — enforce бек. */
export const deleteForm = createAction(async (rawId: string) => {
  const me = await getMe();
  requireActive(me);
  const { id } = FormIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/forms/{id}", { params: { path: { id } } });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.FORMS);
  return undefined;
}, "deleteForm");

/** POST /api/forms/{id}/submissions. token — для приватной формы (share-link). */
export const submitForm = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(makeSubmitSchema(await getT("validation")), formData);
  const api = await createApiClient();
  const query: { token?: string } = {};
  if (input.token) query.token = input.token;
  const { data, error } = await api.POST("/api/forms/{id}/submissions", {
    params: { path: { id: input.formId }, query },
    body: { answers: input.answers as never },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.SUBMISSIONS);
  revalidateEntity(Tags.FORMS, input.formId);
  return unwrap(data);
}, "submitForm");

/** PATCH /api/submissions/{id} (editable). Автор — enforce бек. */
export const editSubmission = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(makeSubmissionEditSchema(await getT("validation")), formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/submissions/{id}", {
    params: { path: { id: input.id } },
    body: { answers: input.answers as never },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.SUBMISSIONS, input.id);
  revalidateEntity(Tags.SUBMISSIONS);
  return unwrap(data);
}, "editSubmission");

/** DELETE /api/submissions/{id} (editable, освобождает слот). */
export const deleteSubmission = createAction(async (rawId: string) => {
  const me = await getMe();
  requireActive(me);
  const { id } = SubmissionIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/submissions/{id}", { params: { path: { id } } });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.SUBMISSIONS);
  return undefined;
}, "deleteSubmission");

/** POST /api/submissions/{id}/retract (immutable, сжигает слот). */
export const retractSubmission = createAction(async (rawId: string) => {
  const me = await getMe();
  requireActive(me);
  const { id } = SubmissionIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.POST("/api/submissions/{id}/retract", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.SUBMISSIONS, id);
  revalidateEntity(Tags.SUBMISSIONS);
  return undefined;
}, "retractSubmission");
