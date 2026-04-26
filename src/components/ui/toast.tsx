"use client";
// src/components/ui/toast.tsx
import { Toast as BaseToast } from "@base-ui/react/toast";
import type { ReactNode } from "react";

/**
 * Глобальный провайдер toast-системы. Должен оборачивать всё, что
 * использует `useToast()` (обычно — root layout). Сам по себе не рендерит
 * viewport — для этого есть `<Toaster />`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <BaseToast.Provider>{children}</BaseToast.Provider>;
}

/**
 * Хук для добавления и управления toast-сообщениями. Возвращает менеджер
 * Base UI: `{ toasts, add, close, update, promise }`.
 */
export function useToast() {
  return BaseToast.useToastManager();
}
