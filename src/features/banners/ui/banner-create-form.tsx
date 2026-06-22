"use client";
// src/features/banners/ui/banner-create-form.tsx
import { useActionState, useState } from "react";

import {
  Checkbox,
  ColorInput,
  createTypedForm,
  Form,
  FormFeedback,
  IdempotencyField,
  Inline,
  Label,
  Select,
  Stack,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import { useActionRedirect } from "@/hooks/use-action-redirect";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createBanner } from "../actions";
import { audienceOptions } from "../display";
import type { BannerCreateFormInput } from "../schemas";
import type { Banner } from "../types";

const initial = initialActionState<Banner | null>(null);

const { Field, f, errors } = createTypedForm<BannerCreateFormInput>();

export function BannerCreateForm() {
  const t = useT("banners");
  const [dismissible, setDismissible] = useState(true);
  const [state, action] = useActionState(createBanner, initial);

  useActionRedirect(state, (data) => `/admin/banners/${data.id}/edit`);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-xl">
        {/* Hidden input: omitted-чекбокс в FormData неотличим от «не менять». */}
        <input
          type="hidden"
          name={f("dismissible")}
          value={dismissible ? "true" : "false"}
        />
        <IdempotencyField result={state} />

        <Field name="background_color" label={t("fieldColor")} required>
          <ColorInput
            defaultValue="#336699"
            required
            aria-label={t("fieldColor")}
          />
        </Field>

        <Field name="target_audience" label={t("fieldAudience")} required>
          <Select
            defaultValue="all"
            options={audienceOptions(t)}
            aria-label={t("fieldAudienceAriaLabel")}
          />
        </Field>

        <Inline align="center" gap="tight" className="text-sm">
          <Checkbox id="dismissible" checked={dismissible} onCheckedChange={setDismissible} />
          <Label htmlFor="dismissible">{t("fieldDismissible")}</Label>
        </Inline>

        <Field name="start_at" label={t("fieldStartAt")} required>
          <TextInput type="datetime-local" required />
        </Field>

        <Field name="end_at" label={t("fieldEndAt")}>
          <TextInput type="datetime-local" />
        </Field>

        <Field name="event_id" label={t("fieldEventId")}>
          <TextInput placeholder={t("eventIdPlaceholder")} />
        </Field>

        <FormFeedback result={state} forbiddenAction={t("createAction")} />

        <div>
          <SubmitButton>{t("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
