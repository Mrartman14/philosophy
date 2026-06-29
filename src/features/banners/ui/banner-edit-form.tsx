"use client";
// src/features/banners/ui/banner-edit-form.tsx
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
  Select,
  Stack,
  SubmitButton,
  TextInput,
  VersionField,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";
import { instantToWallClock } from "@/utils/datetime-form";

import { updateBanner } from "../actions";
import { audienceOptions, variantOptions, DEFAULT_BANNER_VARIANT } from "../display";
import type { BannerUpdateFormInput } from "../schemas";
import type { Banner } from "../types";

const initial = initialActionState<Banner | null>(null);

const { Field, f, errors } = createTypedForm<BannerUpdateFormInput>();

interface Props {
  banner: Banner;
  tz: string;
}

export function BannerEditForm({ banner, tz }: Props) {
  const t = useT("banners");
  const [dismissible, setDismissible] = useState(banner.dismissible !== false);
  const [blocks, setBlocks] = useState<AstBlock[]>(banner.blocks ?? []);
  const [state, action] = useActionState(updateBanner, initial);

  // exactOptionalPropertyTypes: успешный текст подставляем только при реальном
  // сохранении (data != null), иначе свойство опускаем — не шлём undefined.
  const successText =
    state.success && state.data ? { successText: t("saved") } : {};

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        <input type="hidden" name={f("id")} value={banner.id ?? ""} />
        {/* version (If-Match) — НЕ ключ схемы → raw name. */}
        <VersionField version={banner.version} />
        <input
          type="hidden"
          name={f("blocks")}
          value={JSON.stringify(blocks)}
        />
        <input
          type="hidden"
          name={f("dismissible")}
          value={dismissible ? "true" : "false"}
        />
        <IdempotencyField result={state} />

        <Field name="variant" label={t("fieldVariant")} required>
          <Select
            defaultValue={banner.variant ?? DEFAULT_BANNER_VARIANT}
            options={variantOptions(t)}
            aria-label={t("fieldVariant")}
          />
        </Field>

        <Field name="target_audience" label={t("fieldAudience")} required>
          <Select
            defaultValue={banner.target_audience ?? "all"}
            options={audienceOptions(t)}
            aria-label={t("fieldAudienceAriaLabel")}
          />
        </Field>

        <Inline align="center" gap="tight" className="text-sm">
          <Checkbox id="dismissible" checked={dismissible} onCheckedChange={setDismissible} />
          <Label htmlFor="dismissible">{t("fieldDismissible")}</Label>
        </Inline>

        <Field name="start_at" label={t("fieldStartAt")} required>
          <TextInput
            type="datetime-local"
            defaultValue={instantToWallClock(banner.start_at, tz)}
            aria-required
          />
        </Field>

        <Field name="end_at" label={t("fieldEndAt")}>
          <TextInput
            type="datetime-local"
            defaultValue={instantToWallClock(banner.end_at, tz)}
          />
        </Field>
        <p className="text-xs text-(--color-fg-muted)">
          {t("hintEndAt")}
        </p>

        <Field name="event_id" label={t("fieldEventId")}>
          <TextInput
            defaultValue={banner.event_id ?? ""}
            placeholder={t("eventIdPlaceholder")}
          />
        </Field>
        <p className="text-xs text-(--color-fg-muted)">
          {t("hintEventId")}
        </p>

        <Field name="blocks" label={t("fieldBlocks")} required>
          <LazyAstEditor
            defaultValue={banner.blocks ?? []}
            entityContext="banner"
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
