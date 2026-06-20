"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { setUsageTracking } from "../actions";

interface Props {
  initialEnabled: boolean;
  /** canManageTokens(me) со страницы (server component). */
  canManage: boolean;
}

export function UsageTrackingToggle({ initialEnabled, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("tokens");
  const tErrors = useT("errors");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function apply(next: boolean) {
    setPending(true);
    try {
      const result = await setUsageTracking(next);
      if (!result.success) {
        toastActionError(toast, tErrors, result, {
          action: t("usageTrackingManageAction"),
        });
        return;
      }
      setEnabled(next);
      toast.add({
        title: t("usageTrackingSavedTitle"),
        description: next
          ? t("usageTrackingEnabledToast")
          : t("usageTrackingDisabledToast"),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
      <h2 className="text-sm font-semibold">{t("usageTrackingHeading")}</h2>
      <p className="text-xs text-(--color-fg-muted)">{t("usageTrackingIntro")}</p>
      {enabled ? (
        <>
          <p className="text-sm">{t("usageTrackingEnabledStatus")}</p>
          <ConfirmDialog
            destructive
            trigger={
              <Button
                variant="secondary"
                className="self-start"
                disabled={pending || !canManage}
              >
                {t("usageTrackingDisableButton")}
              </Button>
            }
            title={t("usageTrackingDisableDialogTitle")}
            description={t("usageTrackingDisableDialogDescription")}
            confirmLabel={t("usageTrackingDisableConfirmLabel")}
            onConfirm={() => apply(false)}
          />
        </>
      ) : (
        <>
          <p className="text-sm">{t("usageTrackingDisabledStatus")}</p>
          <Button
            className="self-start"
            disabled={pending || !canManage}
            onClick={() => {
              void apply(true);
            }}
          >
            {t("usageTrackingEnableButton")}
          </Button>
        </>
      )}
    </section>
  );
}
