"use client";
// src/features/events/ui/event-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

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
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createEvent } from "../actions";
import type { EventCreateFormInput } from "../schemas";
import type { CalendarEvent } from "../types";

const initial: ActionResult<CalendarEvent | null> = {
  success: true,
  data: null,
};

const { Field, errors } = createTypedForm<EventCreateFormInput>();

export function EventCreateForm() {
  const t = useT("events");
  const router = useRouter();
  const [allDay, setAllDay] = useState(true);
  const [state, action] = useActionState(createEvent, initial);

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/admin/events/${state.data.id}/edit`);
    }
  }, [state, router]);

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
