"use client";
// src/features/users/ui/user-role-control.tsx
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Select, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { setUserRole } from "../actions";
import type { UserRole } from "../types";

interface Props {
  userId: string;
  username: string;
  current: UserRole;
}

export function UserRoleControl({ userId, username, current }: Props) {
  const t = useT("users");
  const [value, setValue] = useState<string>(current);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const dirty = value !== current;

  const ROLE_OPTIONS = [
    { value: "user", label: t("roleUser") },
    { value: "admin", label: t("roleAdmin") },
  ];

  async function apply() {
    const result = await setUserRole({ id: userId, role: value });
    if (!result.success) {
      toastActionError(toast, result, {
        action: t("changeRoleAction"),
        forbiddenTitle: t("changeRoleFailed"),
        failureTitle: t("changeRoleFailed"),
      });
      return;
    }
    toast.add({ title: t("roleUpdated"), description: username });
    startTransition(() => { router.refresh(); });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label={t("roleAriaLabel", { username })}
        options={ROLE_OPTIONS}
        value={value}
        onValueChange={setValue}
        disabled={isPending}
        className="w-44"
      />
      {dirty && (
        <Button size="sm" disabled={isPending} onClick={() => void apply()}>
          {t("applyButton")}
        </Button>
      )}
    </div>
  );
}
