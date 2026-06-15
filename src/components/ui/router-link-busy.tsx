// src/components/ui/router-link-busy.tsx
"use client";
import { useLinkStatus } from "next/link";

// Публикует in-flight состояние навигации как zero-layout DOM-маркер
// [data-link-pending]. Это сигнал, а не художник: предок рисует волну через
// :has([data-link-pending]). Рендерит ТОЛЬКО маркер — контент <a> остаётся
// прямым ребёнком <a> (важно при использовании RouterLink как render-таргета).
// `hidden` держит маркер вне layout и a11y-дерева, но матчится :has().
export function RouterLinkBusy() {
  const { pending } = useLinkStatus();
  return pending ? <span hidden data-link-pending="" /> : null;
}
