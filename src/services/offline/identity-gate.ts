// src/services/offline/identity-gate.ts
// Барьер «личность офлайн-кеша сверена». Офлайн-ЧТЕНИЯ ждут whenIdentityReconciled(),
// чтобы в окне между загрузкой страницы и зачисткой в OfflineIdentityGuard не показать
// данные ПРЕДЫДУЩЕГО владельца устройства.
//
// Стартует ОТКРЫТЫМ: если гвард не смонтирован (юнит-тесты компонентов, нестандартные
// поверхности) — чтения не зависают. Гвард закрывает барьер В РЕНДЕРЕ при смене userId
// (рендер-фаза целиком предшествует эффектам, поэтому read-эффекты потомков дождутся
// сверки, хотя их эффекты и выполняются раньше эффекта гварда-предка) и открывает
// после завершения reconcileOfflineOwner.

let resolveGate: (() => void) | null = null;
let gate: Promise<void> = Promise.resolve();

/** Закрыть барьер перед сверкой личности. Идемпотентно: на уже закрытом — no-op. */
export function closeIdentityGate(): void {
  if (resolveGate) return;
  gate = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });
}

/** Открыть барьер по завершении сверки. Идемпотентно. */
export function openIdentityGate(): void {
  resolveGate?.();
  resolveGate = null;
}

/** Дождаться сверки личности (резолвится сразу, если барьер открыт). */
export function whenIdentityReconciled(): Promise<void> {
  return gate;
}
