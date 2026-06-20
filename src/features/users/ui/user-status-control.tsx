"use client";
// src/features/users/ui/user-status-control.tsx
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, ConfirmDialog, Select, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { setUserStatus } from "../actions";
import type { UserStatus } from "../types";

interface Props {
  userId: string;
  username: string;
  current: UserStatus;
}

export function UserStatusControl({ userId, username, current }: Props) {
  const t = useT("users");
  const tErrors = useT("errors");
  const [value, setValue] = useState<string>(current);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const dirty = value !== current;

  const STATUS_OPTIONS = [
    { value: "active", label: t("statusActive") },
    { value: "suspended", label: t("statusSuspended") },
    { value: "banned", label: t("statusBanned") },
  ];

  async function apply() {
    const result = await setUserStatus({ id: userId, status: value });
    if (!result.success) {
      toastActionError(toast, tErrors, result, {
        action: t("changeStatusAction"),
        forbiddenTitle: t("changeStatusFailed"),
        failureTitle: t("changeStatusFailed"),
      });
      return;
    }
    toast.add({ title: t("statusUpdated"), description: username });
    startTransition(() => { router.refresh(); });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label={t("statusAriaLabel", { username })}
        options={STATUS_OPTIONS}
        value={value}
        onValueChange={setValue}
        disabled={isPending}
        className="w-44"
      />
      {dirty && value === "banned" ? (
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="danger" disabled={isPending}>
              {t("applyButton")}
            </Button>
          }
          title={t("confirmBanTitle", { username })}
          description={t("confirmBanDescription")}
          destructive
          confirmLabel={t("confirmBanLabel")}
          onConfirm={apply}
        />
      ) : dirty ? (
        <Button size="sm" disabled={isPending} onClick={() => void apply()}>
          {t("applyButton")}
        </Button>
      ) : null}
    </div>
  );
}
