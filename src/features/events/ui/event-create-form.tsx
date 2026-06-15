"use client";
// src/features/events/ui/event-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  Checkbox,
  Form,
  FormField,
  IdempotencyField,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { createEvent } from "../actions";
import type { CalendarEvent } from "../types";

const initial: ActionResult<CalendarEvent | null> = {
  success: true,
  data: null,
};

export function EventCreateForm() {
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
    <Form action={action} errors={fieldErrors} className="max-w-xl">
      <IdempotencyField result={state} />
      <FormField name="title" label="Название" required>
        <TextInput
          name="title"
          required
          maxLength={500}
          placeholder="Например: «Семинар по Канту»"
        />
      </FormField>

      <label htmlFor="all_day" className="flex items-center gap-2 text-sm">
        <Checkbox id="all_day" name="all_day" checked={allDay} onCheckedChange={setAllDay} />
        Весь день
      </label>

      <FormField
        name="start_date"
        label={allDay ? "Дата начала" : "Дата и время начала (UTC)"}
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
            ? "Дата окончания (необязательно)"
            : "Дата и время окончания (UTC, необязательно)"
        }
      >
        <TextInput name="end_date" type={allDay ? "date" : "datetime-local"} />
      </FormField>

      <FormField name="rrule" label="Повторение (RRULE, необязательно)">
        <TextInput name="rrule" placeholder="FREQ=WEEKLY;BYDAY=MO" />
      </FormField>

      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">
          У вас нет прав на создание события.
        </p>
      )}
      {!state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Создать</SubmitButton>
      </div>
    </Form>
  );
}
