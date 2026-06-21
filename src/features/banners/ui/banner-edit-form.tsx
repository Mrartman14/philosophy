"use client";
// src/features/banners/ui/banner-edit-form.tsx
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { LazyAstEditor } from "@/components/ast-editor/lazy-ast-editor";
import {
  Checkbox,
  ColorInput,
  Form,
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

import { updateBanner } from "../actions";
import { audienceOptions, toColorInputValue } from "../display";
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
  const t = useT("banners");
  const tErrors = useT("errors");
  const [dismissible, setDismissible] = useState(banner.dismissible !== false);
  const [blocks, setBlocks] = useState<AstBlock[]>(banner.blocks ?? []);
  const [state, action] = useActionState(updateBanner, initial);

  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack>
        <input type="hidden" name="id" value={banner.id ?? ""} />
        <input type="hidden" name="version" value={banner.version ?? ""} />
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
        <input
          type="hidden"
          name="dismissible"
          value={dismissible ? "true" : "false"}
        />
        <IdempotencyField result={state} />

        <FormField name="background_color" label={t("fieldColor")} required>
          <ColorInput
            name="background_color"
            defaultValue={toColorInputValue(banner.background_color)}
            required
            aria-label={t("fieldColor")}
          />
        </FormField>

        <FormField name="target_audience" label={t("fieldAudience")} required>
          <Select
            name="target_audience"
            defaultValue={banner.target_audience ?? "all"}
            options={audienceOptions(t)}
            aria-label={t("fieldAudienceAriaLabel")}
          />
        </FormField>

        <Inline align="center" gap="tight" className="text-sm">
          <Checkbox id="dismissible" checked={dismissible} onCheckedChange={setDismissible} />
          <Label htmlFor="dismissible">{t("fieldDismissible")}</Label>
        </Inline>

        <FormField name="start_at" label={t("fieldStartAt")} required>
          <TextInput
            name="start_at"
            type="datetime-local"
            defaultValue={toDatetimeLocal(banner.start_at)}
            required
          />
        </FormField>

        <FormField name="end_at" label={t("fieldEndAt")}>
          <TextInput
            name="end_at"
            type="datetime-local"
            defaultValue={toDatetimeLocal(banner.end_at)}
          />
        </FormField>
        <p className="text-xs text-(--color-fg-muted)">
          {t("hintEndAt")}
        </p>

        <FormField name="event_id" label={t("fieldEventId")}>
          <TextInput
            name="event_id"
            defaultValue={banner.event_id ?? ""}
            placeholder={t("eventIdPlaceholder")}
          />
        </FormField>
        <p className="text-xs text-(--color-fg-muted)">
          {t("hintEventId")}
        </p>

        <FormField name="blocks" label={t("fieldBlocks")}>
          <LazyAstEditor
            defaultValue={banner.blocks ?? []}
            entityContext="banner"
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
          />
        </FormField>

        {state.success && state.data && (
          <p className="text-sm text-(--color-fg-muted)">{t("saved")}</p>
        )}
        {!state.success && state.code === "forbidden" && (
          <p className="text-sm text-red-600">
            {tErrors("forbiddenAction", { action: t("editAction") })}
          </p>
        )}
        {!state.success &&
          state.code === "validation" &&
          fieldErrors._form && (
            <p role="alert" className="text-sm text-red-600">
              {fieldErrors._form}
            </p>
          )}
        {!state.success && !state.code && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <div>
          <SubmitButton>{t("saveButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
