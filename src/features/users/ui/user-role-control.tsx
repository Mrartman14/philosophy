"use client";
// src/features/users/ui/user-role-control.tsx
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Select, useToast } from "@/components/ui";
import { toastActionError } from "@/utils/action-toast";

import { setUserRole } from "../actions";
import type { UserRole } from "../types";

const ROLE_OPTIONS = [
  { value: "user", label: "Пользователь" },
  { value: "admin", label: "Администратор" },
];

interface Props {
  userId: string;
  username: string;
  current: UserRole;
}

export function UserRoleControl({ userId, username, current }: Props) {
  const [value, setValue] = useState<string>(current);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const dirty = value !== current;

  async function apply() {
    const result = await setUserRole({ id: userId, role: value });
    if (!result.success) {
      toastActionError(toast, result, {
        action: "изменение роли пользователя",
        forbiddenTitle: "Не удалось изменить роль",
        failureTitle: "Не удалось изменить роль",
      });
      return;
    }
    toast.add({ title: "Роль обновлена", description: username });
    startTransition(() => { router.refresh(); });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label={`Роль пользователя ${username}`}
        options={ROLE_OPTIONS}
        value={value}
        onValueChange={setValue}
        disabled={isPending}
        className="w-44"
      />
      {dirty && (
        <Button size="sm" disabled={isPending} onClick={() => void apply()}>
          Применить
        </Button>
      )}
    </div>
  );
}
