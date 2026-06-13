// src/features/forms/types.ts
import type { components } from "@/api/schema";

/** Полная форма (GET /api/forms/{id}). Поля description/fields/after_submit_blocks приходят как ast.Block[]. */
export type Form = components["schemas"]["form.Form"];

/** Одно поле формы. */
export type FormField = components["schemas"]["form.FormField"];

/** Вариант выбора для single/multi choice. */
export type FieldOption = components["schemas"]["form.FieldOption"];

/** Тип поля: text | long_text | single_choice | multi_choice | number | date. */
export type FieldType = components["schemas"]["form.FieldType"];

/** Режим откликов: editable | immutable. */
export type SubmissionMode = components["schemas"]["form.SubmissionMode"];

/** Видимость: private | public. */
export type Visibility = components["schemas"]["access.Visibility"];

/** Отклик с ответами (GET /api/submissions/{id}). */
export type Submission = components["schemas"]["form.Submission"];

/** Один ответ внутри отклика. value — произвольный JSON по типу поля. */
export type Answer = components["schemas"]["form.Answer"];

/** Конверт ответа submit/edit (содержит submission + after_submit_blocks). */
export type SubmitResponse = components["schemas"]["form.SubmitResponse"];

/** Лёгкий элемент списка форм (/api/me/forms, /api/admin/forms). */
export type FormListItem = components["schemas"]["form.FormListItem"];

/** Лёгкий элемент списка откликов (/api/me/submissions, /api/forms/{id}/submissions). */
export type SubmissionListItem = components["schemas"]["form.SubmissionListItem"];

/** ast.Block для рендера description/prompt/help_text/after_submit. */
export type AstBlock = components["schemas"]["ast.Block"];
