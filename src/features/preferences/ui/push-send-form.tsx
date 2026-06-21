"use client";
// src/features/preferences/ui/push-send-form.tsx
import { useActionState } from "react";

import {
  Form,
  FormField,
  IdempotencyField,
  Stack,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { sendPushBroadcast } from "../actions";

// data: false — начальное состояние; true — рассылка принята (202).
const initial: ActionResult<boolean> = { success: true, data: false };

export function PushSendForm() {
  // Case 3 (branded forbidden): общий шаблон errors.forbiddenAction + per-feature
  // действие в родительном падеже из namespace preferences.
  const tErrors = useT("errors");
  const tPrefs = useT("preferences");
  const [state, action] = useActionState(sendPushBroadcast, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

  return (
    <Form action={action} errors={fieldErrors}>
      <Stack className="max-w-xl">
        <IdempotencyField result={state} />
        <FormField name="title" label={tPrefs("pushTitleLabel")} required>
          <TextInput
            name="title"
            required
            maxLength={200}
            placeholder={tPrefs("pushTitlePlaceholder")}
          />
        </FormField>

        <FormField name="body" label={tPrefs("pushBodyLabel")}>
          <Textarea name="body" maxLength={1000} rows={4} />
        </FormField>

        <FormField
          name="url"
          label={tPrefs("pushUrlLabel")}
          description={tPrefs("pushUrlDescription")}
        >
          <TextInput name="url" placeholder="/lectures/…" />
        </FormField>

        {!state.success && state.code === "forbidden" && (
          <p className="text-sm text-red-600">
            {tErrors("forbiddenAction", { action: tPrefs("pushSendAction") })}
          </p>
        )}
        {!state.success && !state.code && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        {state.success && state.data && (
          <p className="text-sm text-(--color-fg-muted)">
            {tPrefs("pushSendAccepted")}
          </p>
        )}

        <div>
          <SubmitButton>{tPrefs("pushSendButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
