"use client";

// Глобальные window-обработчики: необработанные ошибки и реджекты промисов
// → errors.capture(handled:false). Вынесено из instrumentation-client.ts,
// чтобы цель addEventListener можно было подставить в тестах.
import { errors } from "./client";

interface ErrorLikeEvent {
  error?: unknown;
  message?: string;
}
interface RejectionLikeEvent {
  reason?: unknown;
}

export function registerClientErrorHandlers(
  target: Pick<Window, "addEventListener">,
): void {
  target.addEventListener("error", (ev: Event) => {
    const e = ev as unknown as ErrorLikeEvent;
    errors.capture(e.error ?? e.message ?? "unknown error", {
      handled: false,
    });
  });
  target.addEventListener("unhandledrejection", (ev: Event) => {
    const e = ev as unknown as RejectionLikeEvent;
    errors.capture(e.reason ?? "unhandled rejection", { handled: false });
  });
}
