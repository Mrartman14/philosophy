"use client";
// src/features/events/ui/event-create-form.tsx
import { useActionState, useState } from "react";

import {
  Checkbox,
  createTypedForm,
  Form,
  FormFeedback,
  IdempotencyField,
  Inline,
  Label,
  Stack,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import { useActionRedirect } from "@/hooks/use-action-redirect";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createEvent } from "../actions";
import type { EventCreateFormInput } from "../schemas";
import type { CalendarEvent } from "../types";

const initial = initialActionState<CalendarEvent | null>(null);

const { Field, errors } = createTypedForm<EventCreateFormInput>();

export function EventCreateForm() {
  const t = useT("events");
  const [allDay, setAllDay] = useState(true);
  const [state, action] = useActionState(createEvent, initial);

  useActionRedirect(state, (data) => `/admin/events/${data.id}/edit`);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-xl">
        <IdempotencyField result={state} />
        <Field name="title" label={t("fieldTitle")} required>
          <TextInput
            required
            maxLength={500}
            placeholder={t("titlePlaceholder")}
          />
        </Field>

        <Inline align="center" gap="tight" className="text-sm">
          <Checkbox id="all_day" name="all_day" checked={allDay} onCheckedChange={setAllDay} />
          <Label htmlFor="all_day">{t("fieldAllDay")}</Label>
        </Inline>

        <Field
          name="start_date"
          label={allDay ? t("fieldStartDate") : t("fieldStartDateTime")}
          required
        >
          <TextInput
            type={allDay ? "date" : "datetime-local"}
            required
          />
        </Field>

        <Field
          name="end_date"
          label={
            allDay
              ? t("fieldEndDate")
              : t("fieldEndDateTime")
          }
        >
          <TextInput type={allDay ? "date" : "datetime-local"} />
        </Field>

        <Field name="rrule" label={t("fieldRrule")}>
          <TextInput placeholder="FREQ=WEEKLY;BYDAY=MO" />
        </Field>

        <FormFeedback result={state} forbiddenAction={t("createAction")} />

        <div>
          <SubmitButton>{t("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
