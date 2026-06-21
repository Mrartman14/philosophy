"use client";
// src/features/banners/ui/banner-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  Checkbox,
  ColorInput,
  Form,
  FormFeedback,
  FormField,
  IdempotencyField,
  Inline,
  Label,
  Select,
  Stack,
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
    <Form action={action} errors={fieldErrors}>
      <Stack className="max-w-xl">
        {/* Hidden input: omitted-чекбокс в FormData неотличим от «не менять». */}
        <input
          type="hidden"
          name="dismissible"
          value={dismissible ? "true" : "false"}
        />
        <IdempotencyField result={state} />

        <FormField name="background_color" label={t("fieldColor")} required>
          <ColorInput
            name="background_color"
            defaultValue="#336699"
            required
            aria-label={t("fieldColor")}
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

        <Inline align="center" gap="tight" className="text-sm">
          <Checkbox id="dismissible" checked={dismissible} onCheckedChange={setDismissible} />
          <Label htmlFor="dismissible">{t("fieldDismissible")}</Label>
        </Inline>

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
      </Stack>
    </Form>
  );
}
