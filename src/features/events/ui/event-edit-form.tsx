"use client";
// src/features/events/ui/event-edit-form.tsx
import { useActionState, useState } from "react";

import { AstEditor } from "@/components/ast-editor";
import type { AstBlock } from "@/components/ast-editor";
import {
  Checkbox,
  Form,
  FormField,
  IdempotencyField,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updateEvent } from "../actions";
import type { CalendarEvent } from "../types";

const initial: ActionResult<CalendarEvent | null> = {
  success: true,
  data: null,
};

/** RFC3339 ("2026-07-01T19:00:00Z") → значение <input type="datetime-local">. */
function toDatetimeLocal(value?: string): string {
  if (!value) return "";
  return value.replace(/Z$/, "").slice(0, 16);
}

interface Props {
  event: CalendarEvent;
}

export function EventEditForm({ event }: Props) {
  const t = useT("events");
  const tErrors = useT("errors");
  const initialAllDay = event.all_day ?? true;
  const [allDay, setAllDay] = useState(initialAllDay);
  const [startDate, setStartDate] = useState(
    initialAllDay ? (event.start_date ?? "") : toDatetimeLocal(event.start_date),
  );
  const [endDate, setEndDate] = useState(
    initialAllDay ? (event.end_date ?? "") : toDatetimeLocal(event.end_date),
  );
  const [blocks, setBlocks] = useState<AstBlock[]>(event.blocks ?? []);
  const [state, action] = useActionState(updateEvent, initial);

  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

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

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={event.id ?? ""} />
      <input type="hidden" name="version" value={event.version ?? ""} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <IdempotencyField result={state} />

      <FormField name="title" label={t("fieldTitle")} required>
        <TextInput
          name="title"
          defaultValue={event.title ?? ""}
          required
          maxLength={500}
        />
      </FormField>

      <label htmlFor="all_day" className="flex items-center gap-2 text-sm">
        <Checkbox
          id="all_day"
          name="all_day"
          checked={allDay}
          onCheckedChange={handleAllDayChange}
        />
        {t("fieldAllDay")}
      </label>

      <FormField
        name="start_date"
        label={allDay ? t("fieldStartDate") : t("fieldStartDateTime")}
        required
      >
        <TextInput
          name="start_date"
          type={allDay ? "date" : "datetime-local"}
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); }}
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
        <TextInput
          name="end_date"
          type={allDay ? "date" : "datetime-local"}
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); }}
        />
      </FormField>

      <FormField name="rrule" label={t("fieldRrule")}>
        <TextInput
          name="rrule"
          defaultValue={event.rrule ?? ""}
          placeholder="FREQ=WEEKLY;BYDAY=MO"
        />
      </FormField>
      <p className="text-xs text-(--color-fg-muted)">
        {t("clearLimitation")}
      </p>

      <FormField name="blocks" label={t("fieldBlocks")}>
        <AstEditor
          defaultValue={event.blocks ?? []}
          entityContext="event"
          onChange={(next: AstBlock[]) => { setBlocks(next); }}
        />
      </FormField>

      {state.success && state.data && (
        <p className="text-sm text-(--color-fg-muted)">{t("savedSuccess")}</p>
      )}
      {!state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">
          {tErrors("forbiddenAction", { action: t("editAction") })}
        </p>
      )}
      {!state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>{t("btnSave")}</SubmitButton>
      </div>
    </Form>
  );
}
