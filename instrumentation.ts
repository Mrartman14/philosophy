// instrumentation.ts
// Next 16 instrumentation hook: бутстрап серверной наблюдаемости при старте
// процесса и единая точка перехвата необработанных ошибок рендера/роутинга.
import { initServerObservability } from "@/services/observability/server";
import { errors } from "@/services/observability";

/** Вызывается Next один раз при инициализации серверного рантайма. */
export function register(): void {
  initServerObservability();
}

/**
 * Сигнатура Next 16: onRequestError(error, request, context).
 * Все ошибки здесь — необработанные (handled: false). Метку route и источник
 * рендера прокидываем атрибутами для группировки.
 */
export function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
    renderSource: string;
    revalidateReason: string | undefined;
  },
): void {
  errors.capture(error, {
    handled: false,
    attributes: {
      route: context.routePath,
      renderSource: context.renderSource,
      method: request.method,
    },
  });
}
