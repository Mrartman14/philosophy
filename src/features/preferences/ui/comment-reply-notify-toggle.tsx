"use client";
// src/features/preferences/ui/comment-reply-notify-toggle.tsx
// Instant-toggle глобального уведомления об ответах на комментарии
// (preference.notify_on_comment_reply). Оптимистичный флип + откат при ошибке;
// на успехе router.refresh() перечитывает getPreferences на странице. Паттерн
// instant-toggle Checkbox+Label — как form-builder-field-row / lecture-tags-form
// (недеструктивно, без ConfirmDialog).
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Checkbox, Inline, Label, Stack, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { setNotifyOnCommentReply } from "../actions";

interface Props {
  initialEnabled: boolean;
  /** canUpdatePreferences(me) со страницы (server component). */
  canManage: boolean;
}

export function CommentReplyNotifyToggle({ initialEnabled, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("preferences");
  const tErrors = useT("errors");
  const id = useId();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function apply(next: boolean) {
    setPending(true);
    setEnabled(next); // оптимистично
    try {
      const result = await setNotifyOnCommentReply(next);
      if (!result.success) {
        setEnabled(!next); // откат
        toastActionError(toast, tErrors, result, { action: t("updateSettingsAction") });
        return;
      }
      toast.add({ title: t("commentReplyNotifySaved") });
      router.refresh();
    } catch {
      setEnabled(!next); // откат при сетевом сбое
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack>
      <Inline gap="tight">
        <Checkbox
          id={id}
          checked={enabled}
          disabled={pending || !canManage}
          onCheckedChange={(next) => {
            void apply(next);
          }}
        />
        <Label htmlFor={id}>{t("commentReplyNotifyLabel")}</Label>
      </Inline>
      <p className="text-sm text-(--color-fg-muted)">
        {t("commentReplyNotifyDescription")}
      </p>
    </Stack>
  );
}
