"use client";
// src/features/forms/ui/form-builder.tsx
import { useState } from "react";

import { Button, TextInput, Textarea } from "@/components/ui";

import type { FieldType, SubmissionMode, Visibility } from "../types";

import { FormBuilderFieldRow, type BuilderField } from "./form-builder-field-row";

export interface BuilderInitial {
  title: string;
  description: string;
  after_submit: string;
  visibility: Visibility;
  submission_mode: SubmissionMode;
  fields: BuilderField[];
}

interface Props {
  /** Начальное состояние (edit). По умолчанию — пустая форма с одним текстовым полем. */
  initial?: BuilderInitial;
  /** edit-режим: видимость/режим уже зафиксированы, не редактируются здесь. */
  mode: "create" | "edit";
  disabled?: boolean;
}

function emptyField(type: FieldType = "text"): BuilderField {
  return { type, prompt: "", help_text: "", required: false, options: [] };
}

const DEFAULT_INITIAL: BuilderInitial = {
  title: "",
  description: "",
  after_submit: "",
  visibility: "private",
  submission_mode: "editable",
  fields: [emptyField()],
};

/**
 * Конструктор формы. Не самостоятельная <form>: рендерит скрытый
 * <input name="payload"> с JSON всей структуры, который читает обрамляющая
 * форма (FormCreateForm / FormEditForm) через parseFormData(FormCreate/UpdateSchema).
 * sort_order назначается по позиции при сериализации.
 */
export function FormBuilder({ initial, mode, disabled = false }: Props) {
  const init = initial ?? DEFAULT_INITIAL;
  const [title, setTitle] = useState(init.title);
  const [description, setDescription] = useState(init.description);
  const [afterSubmit, setAfterSubmit] = useState(init.after_submit);
  const [visibility, setVisibility] = useState<Visibility>(init.visibility);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>(init.submission_mode);
  const [fields, setFields] = useState<BuilderField[]>(
    init.fields.length > 0 ? init.fields : [emptyField()],
  );

  const payload = JSON.stringify({
    title,
    description,
    after_submit: afterSubmit,
    ...(mode === "create" ? { visibility, submission_mode: submissionMode } : {}),
    fields: fields.map((f, i) => ({
      type: f.type,
      prompt: f.prompt,
      ...(f.help_text.trim() ? { help_text: f.help_text } : {}),
      required: f.required,
      sort_order: i,
      ...(f.options.length > 0 ? { options: f.options } : {}),
    })),
  });

  function patchField(i: number, next: BuilderField) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? next : f)));
  }
  function removeField(i: number) {
    setFields((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }
  function move(i: number, dir: -1 | 1) {
    setFields((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      const a = next[i];
      const b = next[j];
      if (a === undefined || b === undefined) return prev;
      next[i] = b;
      next[j] = a;
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="payload" value={payload} />

      <label htmlFor="form-builder-title" className="flex flex-col gap-1 text-sm">
        Название формы
        <TextInput id="form-builder-title" value={title} disabled={disabled} maxLength={500} onChange={(e) => { setTitle(e.target.value); }} required />
      </label>

      <label htmlFor="form-builder-description" className="flex flex-col gap-1 text-sm">
        Описание (markdown, необязательно)
        <Textarea id="form-builder-description" value={description} disabled={disabled} rows={3} onChange={(e) => { setDescription(e.target.value); }} />
      </label>

      <label htmlFor="form-builder-after-submit" className="flex flex-col gap-1 text-sm">
        Текст после отправки (markdown, необязательно)
        <Textarea id="form-builder-after-submit" value={afterSubmit} disabled={disabled} rows={2} onChange={(e) => { setAfterSubmit(e.target.value); }} />
      </label>

      {mode === "create" && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Видимость
            <select
              className="rounded border border-(--color-border) px-2 py-1 text-sm"
              value={visibility}
              disabled={disabled}
              onChange={(e) => { setVisibility(e.target.value as Visibility); }}
            >
              <option value="private">Приватная</option>
              <option value="public">Публичная (опубликовать сразу)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Режим откликов
            <select
              className="rounded border border-(--color-border) px-2 py-1 text-sm"
              value={submissionMode}
              disabled={disabled}
              onChange={(e) => { setSubmissionMode(e.target.value as SubmissionMode); }}
            >
              <option value="editable">Редактируемый (можно менять/удалять отклик)</option>
              <option value="immutable">Без изменений (только отозвать)</option>
            </select>
          </label>
          <p className="text-xs text-(--color-description)">
            Режим «без изменений» нельзя будет смягчить позже. Публичную форму нельзя вернуть в приватную, а её структуру — менять.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {fields.map((f, i) => (
          <FormBuilderFieldRow
            key={i}
            index={i}
            field={f}
            disabled={disabled}
            onChange={(next) => { patchField(i, next); }}
            onRemove={() => { removeField(i); }}
            onMoveUp={() => { move(i, -1); }}
            onMoveDown={() => { move(i, 1); }}
            canMoveUp={i > 0}
            canMoveDown={i < fields.length - 1}
          />
        ))}
      </div>

      <Button type="button" variant="secondary" disabled={disabled} onClick={() => { setFields((p) => [...p, emptyField()]); }}>
        + Добавить поле
      </Button>
    </div>
  );
}
