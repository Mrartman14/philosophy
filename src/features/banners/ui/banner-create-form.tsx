"use client";
// src/features/banners/ui/banner-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  Checkbox,
  Form,
  FormFeedback,
  FormField,
  IdempotencyField,
  Select,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { createBanner } from "../actions";
import { AUDIENCE_OPTIONS } from "../display";
import type { Banner } from "../types";

const initial: ActionResult<Banner | null> = {
  success: true,
  data: null,
};

export function BannerCreateForm() {
  const router = useRouter();
  const [dismissible, setDismissible] = useState(true);
  const [state, action] = useActionState(createBanner, initial);

  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/admin/banners/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="max-w-xl">
      {/* Hidden input: omitted-чекбокс в FormData неотличим от «не менять». */}
      <input
        type="hidden"
        name="dismissible"
        value={dismissible ? "true" : "false"}
      />
      <IdempotencyField result={state} />

      <FormField name="background_color" label="Цвет фона" required>
        <TextInput
          name="background_color"
          type="color"
          defaultValue="#336699"
          className="h-10 w-20 p-1"
          required
        />
      </FormField>

      <FormField name="target_audience" label="Аудитория" required>
        <Select
          name="target_audience"
          defaultValue="all"
          options={AUDIENCE_OPTIONS}
          aria-label="Аудитория"
        />
      </FormField>

      <label htmlFor="dismissible" className="flex items-center gap-2 text-sm">
        <Checkbox id="dismissible" checked={dismissible} onCheckedChange={setDismissible} />
        Пользователь может скрыть баннер
      </label>

      <FormField name="start_at" label="Начало показа (UTC)" required>
        <TextInput name="start_at" type="datetime-local" required />
      </FormField>

      <FormField name="end_at" label="Окончание показа (UTC, необязательно)">
        <TextInput name="end_at" type="datetime-local" />
      </FormField>

      <FormField name="event_id" label="id события (необязательно)">
        <TextInput name="event_id" placeholder="UUID события из /admin/events" />
      </FormField>

      <FormFeedback result={state} forbiddenAction="создание баннера" />

      <div>
        <SubmitButton>Создать</SubmitButton>
      </div>
    </Form>
  );
}
