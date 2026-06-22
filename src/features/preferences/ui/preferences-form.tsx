"use client";
// src/features/preferences/ui/preferences-form.tsx
import { useActionState } from "react";

import { createTypedForm, Form, Select, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updatePreferences } from "../actions";
import type { PreferencesFormInput } from "../schemas";
import type { Preferences, ReadingMode } from "../types";

const initial: ActionResult<Preferences | null> = { success: true, data: null };

const { Field, errors } = createTypedForm<PreferencesFormInput>();

export function PreferencesForm({
  initialReadingMode,
}: {
  initialReadingMode: ReadingMode;
}) {
  const t = useT("preferences");
  const tErrors = useT("errors");
  const [state, action] = useActionState(updatePreferences, initial);

  const READING_MODE_OPTIONS: { value: ReadingMode; label: string }[] = [
    { value: "full", label: t("readingModeFull") },
    { value: "focused", label: t("readingModeFocused") },
  ];

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

        {!state.success && state.code === "forbidden" && (
          <p className="text-sm text-red-600">
            {tErrors("forbiddenAction", { action: t("updateSettingsAction") })}
          </p>
        )}
        {!state.success && !state.code && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        {state.success && state.data !== null && (
          <p className="text-sm text-(--color-fg-muted)">{t("settingsSaved")}</p>
        )}

        <div>
          <SubmitButton>{t("saveButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
