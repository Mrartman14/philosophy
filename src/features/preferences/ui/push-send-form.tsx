"use client";
// src/features/preferences/ui/push-send-form.tsx
import { useActionState } from "react";

import {
  createTypedForm,
  Form,
  FormFeedback,
  IdempotencyField,
  Stack,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { sendPushBroadcast } from "../actions";
import type { PushSendFormInput } from "../schemas";

// data: false — начальное состояние; true — рассылка принята (202).
const initial = initialActionState<boolean>(false);

const { Field, errors } = createTypedForm<PushSendFormInput>();

export function PushSendForm() {
  // Case 3 (branded forbidden): общий шаблон errors.forbiddenAction + per-feature
  // действие в родительном падеже из namespace preferences.
  const tPrefs = useT("preferences");
  const [state, action] = useActionState(sendPushBroadcast, initial);

  // exactOptionalPropertyTypes: successText только при реальном «принято» (202,
  // data === true); начальный state — success+data:false.
  const successText =
    state.success && state.data
      ? { successText: tPrefs("pushSendAccepted") }
      : {};

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

        <FormFeedback
          result={state}
          forbiddenAction={tPrefs("pushSendAction")}
          {...successText}
        />

        <div>
          <SubmitButton>{tPrefs("pushSendButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
