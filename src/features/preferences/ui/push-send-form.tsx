"use client";
// src/features/preferences/ui/push-send-form.tsx
import { useActionState } from "react";

import {
  createTypedForm,
  Form,
  IdempotencyField,
  Stack,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { sendPushBroadcast } from "../actions";
import type { PushSendFormInput } from "../schemas";

// data: false — начальное состояние; true — рассылка принята (202).
const initial: ActionResult<boolean> = { success: true, data: false };

const { Field, errors } = createTypedForm<PushSendFormInput>();

export function PushSendForm() {
  // Case 3 (branded forbidden): общий шаблон errors.forbiddenAction + per-feature
  // действие в родительном падеже из namespace preferences.
  const tErrors = useT("errors");
  const tPrefs = useT("preferences");
  const [state, action] = useActionState(sendPushBroadcast, initial);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-xl">
        <IdempotencyField result={state} />
        <Field name="title" label={tPrefs("pushTitleLabel")} required>
          <TextInput
            required
            maxLength={200}
            placeholder={tPrefs("pushTitlePlaceholder")}
          />
        </Field>

        <Field name="body" label={tPrefs("pushBodyLabel")}>
          <Textarea maxLength={1000} rows={4} />
        </Field>

        <Field
          name="url"
          label={tPrefs("pushUrlLabel")}
          description={tPrefs("pushUrlDescription")}
        >
          <TextInput placeholder="/lectures/…" />
        </Field>

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
