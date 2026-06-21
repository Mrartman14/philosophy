"use client";
// src/features/events/ui/event-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  Checkbox,
  Form,
  FormFeedback,
  FormField,
  IdempotencyField,
  Label,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createEvent } from "../actions";
import type { CalendarEvent } from "../types";

const initial: ActionResult<CalendarEvent | null> = {
  success: true,
  data: null,
};

export function EventCreateForm() {
  const t = useT("events");
  const router = useRouter();
  const [allDay, setAllDay] = useState(true);
  const [state, action] = useActionState(createEvent, initial);

  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/admin/events/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4 max-w-xl">
      <IdempotencyField result={state} />
      <FormField name="title" label={t("fieldTitle")} required>
        <TextInput
          name="title"
          required
          maxLength={500}
          placeholder={t("titlePlaceholder")}
        />
      </FormField>

      <Label htmlFor="all_day" className="flex items-center gap-2 text-sm">
        <Checkbox id="all_day" name="all_day" checked={allDay} onCheckedChange={setAllDay} />
        {t("fieldAllDay")}
      </Label>

      <FormField
        name="start_date"
        label={allDay ? t("fieldStartDate") : t("fieldStartDateTime")}
        required
      >
        <TextInput
          name="start_date"
          type={allDay ? "date" : "datetime-local"}
          required
        />
      </FormField>

      <FormField
        name="end_date"
        label={
          allDay
            ? t("fieldEndDate")
            : t("fieldEndDateTime")
        }
      >
        <TextInput name="end_date" type={allDay ? "date" : "datetime-local"} />
      </FormField>

      <FormField name="rrule" label={t("fieldRrule")}>
        <TextInput name="rrule" placeholder="FREQ=WEEKLY;BYDAY=MO" />
      </FormField>

      <FormFeedback result={state} forbiddenAction={t("createAction")} />

      <div>
        <SubmitButton>{t("createButton")}</SubmitButton>
      </div>
    </Form>
  );
}
