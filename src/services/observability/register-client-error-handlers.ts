// Глобальные window-обработчики: необработанные ошибки и реджекты промисов
// → errors.capture(handled:false). Вынесено из instrumentation-client.ts,
// чтобы цель addEventListener можно было подставить в тестах.
import { errors } from "./client";

export function registerClientErrorHandlers(target: Window): void {
  target.addEventListener("error", (ev: ErrorEvent) => {
    errors.capture(ev.error ?? ev.message ?? "unknown error", {
      handled: false,
      attributes: { kind: "window.error" },
    });
  });
  target.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    errors.capture(ev.reason ?? "unhandled rejection", {
      handled: false,
      attributes: { kind: "unhandledrejection" },
    });
  });
}
