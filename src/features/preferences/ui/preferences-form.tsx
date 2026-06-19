"use client";
// src/features/preferences/ui/preferences-form.tsx
import { useActionState } from "react";

import { Form, FormField, Select, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updatePreferences } from "../actions";
import type { Preferences, ReadingMode } from "../types";

const initial: ActionResult<Preferences | null> = { success: true, data: null };

export function PreferencesForm({
  initialReadingMode,
}: {
  initialReadingMode: ReadingMode;
}) {
  const t = useT("preferences");
  const tErrors = useT("errors");
  const [state, action] = useActionState(updatePreferences, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  const READING_MODE_OPTIONS: { value: ReadingMode; label: string }[] = [
    { value: "full", label: t("readingModeFull") },
    { value: "focused", label: t("readingModeFocused") },
  ];

  return (
    <Form
      action={action}
      errors={fieldErrors}
      className="flex max-w-xl flex-col gap-4"
    >
      <FormField
        name="reading_mode"
        label={t("readingModeLabel")}
        description={t("readingModeDescription")}
      >
        <Select
          name="reading_mode"
          defaultValue={initialReadingMode}
          options={READING_MODE_OPTIONS}
          aria-label={t("readingModeAriaLabel")}
        />
      </FormField>

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
    </Form>
  );
}
