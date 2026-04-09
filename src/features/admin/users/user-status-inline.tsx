"use client";

import { useEffect, useState, useTransition } from "react";
import type { UserStatus } from "@/api/types";
import { updateUserStatus } from "@/features/admin/actions";

interface UserStatusInlineProps {
  userId: string;
  currentStatus: UserStatus;
}

export const UserStatusInline: React.FC<UserStatusInlineProps> = ({
  userId,
  currentStatus,
}) => {
  const [status, setStatus] = useState<UserStatus>(currentStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Синхронизируем локальный state с пропсом после revalidatePath
  // (родитель перерисовывается, но компонент не перемонтируется).
  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const handleChange = (next: UserStatus) => {
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const result = await updateUserStatus({ userId, status: next });
      if (!result.success) {
        setError(
          result.code === "forbidden"
            ? "У вас нет прав на изменение статуса пользователя."
            : result.error
        );
        setStatus(currentStatus);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value as UserStatus)}
        disabled={pending}
        className="px-2 py-1 border border-(--color-border) rounded bg-transparent text-xs disabled:opacity-50"
      >
        <option value="active">active</option>
        <option value="suspended">suspended</option>
        <option value="banned">banned</option>
      </select>
      {error && (
        <span role="alert" className="text-xs text-red-500">
          {error}
        </span>
      )}
    </div>
  );
};
