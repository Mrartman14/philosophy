"use client";
// src/features/banners/ui/banner-edit-form.tsx
import { useActionState, useState } from "react";
import {
  Checkbox,
  Form,
  FormField,
  Select,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { AstEditor } from "@/components/ast-editor";
import type { AstBlock } from "@/components/ast-editor";
import { updateBanner } from "../actions";
import { AUDIENCE_OPTIONS, toColorInputValue } from "../display";
import type { Banner } from "../types";

const initial: ActionResult<Banner | null> = {
  success: true,
  data: null,
};

/** RFC3339 ("2026-07-01T19:00:00Z") → значение <input type="datetime-local">. */
function toDatetimeLocal(value?: string): string {
  if (!value) return "";
  return value.replace(/Z$/, "").slice(0, 16);
}

interface Props {
  banner: Banner;
}

export function BannerEditForm({ banner }: Props) {
  const [dismissible, setDismissible] = useState(banner.dismissible !== false);
  const [blocks, setBlocks] = useState<AstBlock[]>(banner.blocks ?? []);
  const [state, action] = useActionState(updateBanner, initial);

  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation"
      ? state.fieldErrors
      : {};

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={banner.id ?? ""} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <input
        type="hidden"
        name="dismissible"
        value={dismissible ? "true" : "false"}
      />

      <FormField name="background_color" label="Цвет фона" required>
        <TextInput
          name="background_color"
          type="color"
          defaultValue={toColorInputValue(banner.background_color)}
          className="h-10 w-20 p-1"
          required
        />
      </FormField>

      <FormField name="target_audience" label="Аудитория" required>
        <Select
          name="target_audience"
          defaultValue={banner.target_audience ?? "all"}
          options={AUDIENCE_OPTIONS}
          aria-label="Аудитория"
        />
      </FormField>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={dismissible} onCheckedChange={setDismissible} />
        Пользователь может скрыть баннер
      </label>

      <FormField name="start_at" label="Начало показа (UTC)" required>
        <TextInput
          name="start_at"
          type="datetime-local"
          defaultValue={toDatetimeLocal(banner.start_at)}
          required
        />
      </FormField>

      <FormField name="end_at" label="Окончание показа (UTC, необязательно)">
        <TextInput
          name="end_at"
          type="datetime-local"
          defaultValue={toDatetimeLocal(banner.end_at)}
        />
      </FormField>
      <p className="text-xs text-(--color-description)">
        Уже сохранённое «Окончание показа» очистить нельзя — бекенд игнорирует
        пустое значение этого поля.
      </p>

      <FormField name="event_id" label="id события (необязательно)">
        <TextInput
          name="event_id"
          defaultValue={banner.event_id ?? ""}
          placeholder="UUID события из /admin/events"
        />
      </FormField>
      <p className="text-xs text-(--color-description)">
        Чтобы отвязать событие — очистите поле и сохраните.
      </p>

      <FormField name="blocks" label="Текст баннера">
        <AstEditor
          defaultValue={banner.blocks ?? []}
          entityContext="banner"
          onChange={(next: AstBlock[]) => setBlocks(next)}
        />
      </FormField>

      {state.success && state.data && (
        <p className="text-sm text-(--color-description)">Сохранено.</p>
      )}
      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">
          У вас нет прав на изменение баннера.
        </p>
      )}
      {state.success === false &&
        state.code === "validation" &&
        fieldErrors._form && (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors._form}
          </p>
        )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </Form>
  );
}
