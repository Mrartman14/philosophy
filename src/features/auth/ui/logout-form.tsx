// src/features/auth/ui/logout-form.tsx
"use client";
import { Button } from "@/components/ui";
import { logoutAction } from "../actions";

interface LogoutFormProps {
  username: string;
}

export function LogoutForm({ username }: LogoutFormProps) {
  return (
    <form action={logoutAction} className="flex items-center gap-2">
      <span className="text-sm text-(--color-description)">{username}</span>
      <Button type="submit" variant="ghost" size="sm">
        Выйти
      </Button>
    </form>
  );
}
