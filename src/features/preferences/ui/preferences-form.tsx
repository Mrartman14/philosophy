"use client";
// src/features/preferences/ui/preferences-form.tsx
import { useActionState } from "react";

import { Form, FormField, Select, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { updatePreferences } from "../actions";
import type { Preferences, ReadingMode } from "../types";

const initial: ActionResult<Preferences | null> = { success: true, data: null };

const READING_MODE_OPTIONS: { value: ReadingMode; label: string }[] = [
  { value: "full", label: "Полный" },
  { value: "focused", label: "Фокусированный" },
];

export function PreferencesForm({
  initialReadingMode,
}: {
  initialReadingMode: ReadingMode;
}) {
  const [state, action] = useActionState(updatePreferences, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  return (
    <Form
      action={action}
      errors={fieldErrors}
      className="flex max-w-xl flex-col gap-4"
    >
      <FormField
        name="reading_mode"
        label="Режим чтения"
        description="«Фокусированный» скрывает второстепенные элементы на странице лекции."
      >
        <Select
          name="reading_mode"
          defaultValue={initialReadingMode}
          options={READING_MODE_OPTIONS}
          aria-label="Режим чтения"
        />
      </FormField>

      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">
          У вас нет прав на изменение настроек.
        </p>
      )}
      {!state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state.success && state.data !== null && (
        <p className="text-sm text-(--color-description)">Настройки сохранены.</p>
      )}

      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </Form>
  );
}
