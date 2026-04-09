"use client";

import { useState, useTransition } from "react";
import { updateUserStatus } from "@/features/admin/actions";

type UserStatus = "active" | "suspended" | "banned";

export const UserStatusForm: React.FC = () => {
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<UserStatus>("active");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setError("Укажите ID пользователя");
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updateUserStatus({ userId: userId.trim(), status });
      if (result.success) {
        setMessage(`Статус пользователя изменён на «${status}»`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border border-(--color-border) rounded-lg p-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span>ID пользователя</span>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="px-3 py-2 border border-(--color-border) rounded bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Новый статус</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as UserStatus)}
          className="px-3 py-2 border border-(--color-border) rounded bg-transparent"
        >
          <option value="active">active</option>
          <option value="suspended">suspended</option>
          <option value="banned">banned</option>
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start px-3 py-2 bg-(--color-primary) text-(--color-background) rounded text-sm disabled:opacity-50"
      >
        {pending ? "Сохранение…" : "Изменить статус"}
      </button>

      {message && (
        <p className="text-xs text-(--color-description)">{message}</p>
      )}
      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </form>
  );
};
