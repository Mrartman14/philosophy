"use client";
// src/features/users/ui/user-status-control.tsx
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, ConfirmDialog, Select, useToast } from "@/components/ui";
import { toastActionError } from "@/utils/action-toast";

import { setUserStatus } from "../actions";
import type { UserStatus } from "../types";

const STATUS_OPTIONS = [
  { value: "active", label: "Активен" },
  { value: "suspended", label: "Приостановлен" },
  { value: "banned", label: "Заблокирован" },
];

interface Props {
  userId: string;
  username: string;
  current: UserStatus;
}

export function UserStatusControl({ userId, username, current }: Props) {
  const [value, setValue] = useState<string>(current);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const dirty = value !== current;

  async function apply() {
    const result = await setUserStatus({ id: userId, status: value });
    if (!result.success) {
      toastActionError(toast, result, {
        action: "изменение статуса пользователя",
        forbiddenTitle: "Не удалось изменить статус",
        failureTitle: "Не удалось изменить статус",
      });
      return;
    }
    toast.add({ title: "Статус обновлён", description: username });
    startTransition(() => { router.refresh(); });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label={`Статус пользователя ${username}`}
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
              Применить
            </Button>
          }
          title={`Заблокировать ${username}?`}
          description="Заблокированный пользователь не сможет войти в систему. Статус можно будет вернуть позже."
          destructive
          confirmLabel="Заблокировать"
          onConfirm={apply}
        />
      ) : dirty ? (
        <Button size="sm" disabled={isPending} onClick={() => void apply()}>
          Применить
        </Button>
      ) : null}
    </div>
  );
}
