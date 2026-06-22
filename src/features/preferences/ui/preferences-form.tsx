"use client";
// src/features/preferences/ui/preferences-form.tsx
import { useActionState } from "react";

import { createTypedForm, Form, FormFeedback, Select, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { updatePreferences } from "../actions";
import type { PreferencesFormInput } from "../schemas";
import type { Preferences, ReadingMode } from "../types";

const initial = initialActionState<Preferences | null>(null);

const { Field, errors } = createTypedForm<PreferencesFormInput>();

export function PreferencesForm({
  initialReadingMode,
}: {
  initialReadingMode: ReadingMode;
}) {
  const t = useT("preferences");
  const [state, action] = useActionState(updatePreferences, initial);

  const READING_MODE_OPTIONS: { value: ReadingMode; label: string }[] = [
    { value: "full", label: t("readingModeFull") },
    { value: "focused", label: t("readingModeFocused") },
  ];

  // exactOptionalPropertyTypes: successText подставляем только при реальном успехе
  // (начальный state — success+data:null), иначе свойство опускаем.
  const successText =
    state.success && state.data ? { successText: t("settingsSaved") } : {};

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-xl">
        <Field
          name="reading_mode"
          label={t("readingModeLabel")}
          description={t("readingModeDescription")}
          required
        >
          <Select
            defaultValue={initialReadingMode}
            options={READING_MODE_OPTIONS}
            aria-label={t("readingModeAriaLabel")}
          />
        </Field>

        <FormFeedback
          result={state}
          forbiddenAction={t("updateSettingsAction")}
          {...successText}
        />

        <div>
          <SubmitButton>{t("saveButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
