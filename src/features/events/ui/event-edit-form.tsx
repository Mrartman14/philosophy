"use client";
// src/features/events/ui/event-edit-form.tsx
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { LazyAstEditor } from "@/components/ast-editor/lazy-ast-editor";
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
  VersionField,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";
import { instantToWallClock } from "@/utils/datetime-form";

import { updateEvent } from "../actions";
import type { EventUpdateFormInput } from "../schemas";
import type { CalendarEvent } from "../types";

const initial = initialActionState<CalendarEvent | null>(null);

const { Field, f, errors } = createTypedForm<EventUpdateFormInput>();

interface Props {
  event: CalendarEvent;
  tz: string;
}

export function EventEditForm({ event, tz }: Props) {
  const t = useT("events");
  const initialAllDay = event.all_day ?? true;
  const [allDay, setAllDay] = useState(initialAllDay);
  const [startDate, setStartDate] = useState(
    initialAllDay
      ? (event.start_date ?? "")
      : instantToWallClock(event.start_date, tz),
  );
  const [endDate, setEndDate] = useState(
    initialAllDay
      ? (event.end_date ?? "")
      : instantToWallClock(event.end_date, tz),
  );
  const [blocks, setBlocks] = useState<AstBlock[]>(event.blocks ?? []);
  const [state, action] = useActionState(updateEvent, initial);

  // При переключении формата приводим значения, чтобы input
  // type="date"/"datetime-local" не потерял значение.
  const handleAllDayChange = (next: boolean) => {
    setAllDay(next);
    if (next) {
      setStartDate((v) => v.slice(0, 10));
      setEndDate((v) => v.slice(0, 10));
    } else {
      setStartDate((v) => (v ? `${v.slice(0, 10)}T00:00` : v));
      setEndDate((v) => (v ? `${v.slice(0, 10)}T00:00` : v));
    }
  };

  // exactOptionalPropertyTypes: успешный текст подставляем только при реальном
  // сохранении (data != null), иначе свойство опускаем — не шлём undefined.
  const successText =
    state.success && state.data ? { successText: t("savedSuccess") } : {};

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("id")} value={event.id ?? ""} />
        <VersionField version={event.version} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <Field name="title" label={t("fieldTitle")} required>
          <TextInput
            defaultValue={event.title ?? ""}
            required
            maxLength={500}
          />
        </Field>

        <Inline align="center" gap="tight" className="text-sm">
          <Checkbox
            id="all_day"
            name="all_day"
            checked={allDay}
            onCheckedChange={handleAllDayChange}
          />
          <Label htmlFor="all_day">{t("fieldAllDay")}</Label>
        </Inline>

        <Field
          name="start_date"
          label={allDay ? t("fieldStartDate") : t("fieldStartDateTime")}
          required
        >
          <TextInput
            type={allDay ? "date" : "datetime-local"}
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); }}
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
          <TextInput
            type={allDay ? "date" : "datetime-local"}
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); }}
          />
        </Field>

        <Field name="rrule" label={t("fieldRrule")}>
          <TextInput
            defaultValue={event.rrule ?? ""}
            placeholder="FREQ=WEEKLY;BYDAY=MO"
          />
        </Field>
        <p className="text-xs text-(--color-fg-muted)">
          {t("clearLimitation")}
        </p>

        <Field name="blocks" label={t("fieldBlocks")} required>
          <LazyAstEditor
            defaultValue={event.blocks ?? []}
            entityContext="event"
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
          />
        </Field>

        <FormFeedback
          result={state}
          forbiddenAction={t("editAction")}
          {...successText}
        />

        <div>
          <SubmitButton>{t("saveButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
