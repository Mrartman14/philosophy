"use client";
// src/features/media/ui/media-upload-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Form, FormFeedback, FormField, Select, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import type { Media } from "../types";
import { uploadMedia } from "../upload-media";

interface MediaUploadFormProps {
  /** canCreateMedia(me) со страницы. Если false — форма не рендерится. */
  canUpload: boolean;
}

const ACCEPT = ".mp4,.webm,.mp3,.m4a,.ogg,video/*,audio/*";

const initial: ActionResult<Media | null> = { success: true, data: null };

/**
 * Форма загрузки медиа. type выбирается явно (бек требует точный video|audio) и
 * уходит в FormData скрытым input'ом Base UI Select. Новое медиа создаётся
 * приватным (бек: free-floating + private), поэтому выбора видимости здесь нет —
 * публикация делается на /media/[id].
 *
 * Канон: useActionState + <Form action> + FormFeedback (как documents/
 * DocumentUploadForm). На успех остаёмся на странице и обновляем список через
 * router.refresh() — успешный текст показывает FormFeedback.
 */
export function MediaUploadForm({ canUpload }: MediaUploadFormProps) {
  const router = useRouter();
  const t = useT("media");
  const [state, action] = useActionState(uploadMedia, initial);

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.refresh();
    }
  }, [state, router]);

  if (!canUpload) return null;

  // exactOptionalPropertyTypes: не передаём undefined в опциональный successText —
  // подставляем текст только при успешной загрузке (иначе свойство опускаем).
  const successText =
    state.success && state.data ? { successText: t("uploadSuccessTitle") } : {};

  return (
    <Form action={action}>
      <Stack>
        <FormField name="type" label={t("uploadTypeLabel")}>
          <Select
            defaultValue="video"
            aria-label={t("uploadTypeLabel")}
            options={[
              { value: "video", label: t("uploadVideoOption") },
              { value: "audio", label: t("uploadAudioOption") },
            ]}
          />
        </FormField>

        <FormField name="file" label={t("uploadFileLabel")} required>
          <input
            type="file"
            name="file"
            accept={ACCEPT}
            required
            className="text-sm"
          />
        </FormField>

        <FormFeedback
          result={state}
          forbiddenAction={t("uploadAction")}
          {...successText}
        />

        <div>
          <SubmitButton>{t("uploadSubmit")}</SubmitButton>
        </div>

        <p className="text-xs text-(--color-fg-muted)">{t("uploadHint")}</p>
      </Stack>
    </Form>
  );
}
