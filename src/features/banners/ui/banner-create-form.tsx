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
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createBanner } from "../actions";
import { audienceOptions } from "../display";
import type { Banner } from "../types";

const initial: ActionResult<Banner | null> = {
  success: true,
  data: null,
};

export function BannerCreateForm() {
  const t = useT("banners");
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
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4 max-w-xl">
      {/* Hidden input: omitted-чекбокс в FormData неотличим от «не менять». */}
      <input
        type="hidden"
        name="dismissible"
        value={dismissible ? "true" : "false"}
      />
      <IdempotencyField result={state} />

      <FormField name="background_color" label={t("fieldColor")} required>
        <TextInput
          name="background_color"
          type="color"
          defaultValue="#336699"
          className="h-10 w-20 p-1"
          required
        />
      </FormField>

      <FormField name="target_audience" label={t("fieldAudience")} required>
        <Select
          name="target_audience"
          defaultValue="all"
          options={audienceOptions(t)}
          aria-label={t("fieldAudienceAriaLabel")}
        />
      </FormField>

      <label htmlFor="dismissible" className="flex items-center gap-2 text-sm">
        <Checkbox id="dismissible" checked={dismissible} onCheckedChange={setDismissible} />
        {t("fieldDismissible")}
      </label>

      <FormField name="start_at" label={t("fieldStartAt")} required>
        <TextInput name="start_at" type="datetime-local" required />
      </FormField>

      <FormField name="end_at" label={t("fieldEndAt")}>
        <TextInput name="end_at" type="datetime-local" />
      </FormField>

      <FormField name="event_id" label={t("fieldEventId")}>
        <TextInput name="event_id" placeholder={t("eventIdPlaceholder")} />
      </FormField>

      <FormFeedback result={state} forbiddenAction={t("createAction")} />

      <div>
        <SubmitButton>{t("createButton")}</SubmitButton>
      </div>
    </Form>
  );
}
