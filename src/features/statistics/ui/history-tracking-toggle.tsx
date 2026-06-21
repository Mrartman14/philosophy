"use client";
// src/features/statistics/ui/history-tracking-toggle.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { setHistoryTracking } from "../actions";

interface Props {
  initialEnabled: boolean;
  /** canManageOwnHistory(me) со страницы (server component). */
  canManage: boolean;
}

export function HistoryTrackingToggle({ initialEnabled, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("statistics");
  const tErrors = useT("errors");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function apply(next: boolean) {
    setPending(true);
    try {
      const result = await setHistoryTracking(next);
      if (!result.success) {
        toastActionError(toast, tErrors, result, { action: t("manageSettingsAction") });
        return;
      }
      setEnabled(next);
      toast.add({
        title: t("savedTitle"),
        description: next
          ? t("trackingEnabledDescription")
          : t("trackingDisabledAfterPurge"),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (enabled) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">{t("trackingEnabledStatus")}</p>
        <ConfirmDialog
          trigger={
            <Button
              tone="neutral"
              className="self-start"
              disabled={pending || !canManage}
            >
              {t("disableButton")}
            </Button>
          }
          title={t("disableDialogTitle")}
          description={t("disableDialogDescription")}
          destructive
          confirmLabel={t("disableConfirmLabel")}
          onConfirm={() => apply(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{t("trackingDisabledStatus")}</p>
      <Button
        className="self-start"
        disabled={pending || !canManage}
        onClick={() => {
          void apply(true);
        }}
      >
        {t("enableButton")}
      </Button>
      {!canManage && (
        <p className="text-sm text-(--color-fg-muted)">
          {tErrors("forbiddenAction", { action: t("manageSettingsAction") })}
        </p>
      )}
    </div>
  );
}
