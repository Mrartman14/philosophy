"use client";
// src/features/preferences/ui/push-send-form.tsx
import { useActionState } from "react";

import {
  Form,
  FormField,
  IdempotencyField,
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
    <Form
      action={action}
      errors={fieldErrors}
      className="flex max-w-xl flex-col gap-4"
    >
      <IdempotencyField result={state} />
      <FormField name="title" label="Заголовок" required>
        <TextInput
          name="title"
          required
          maxLength={200}
          placeholder="Например: «Новая лекция»"
        />
      </FormField>

      <FormField name="body" label="Текст">
        <Textarea name="body" maxLength={1000} rows={4} />
      </FormField>

      <FormField
        name="url"
        label="Ссылка"
        description="Откроется по клику на уведомление. Путь («/lectures/…») или полный http(s)-URL."
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
          Рассылка принята и будет доставлена подписчикам в фоне.
        </p>
      )}

      <div>
        <SubmitButton>Отправить</SubmitButton>
      </div>
    </Form>
  );
}
