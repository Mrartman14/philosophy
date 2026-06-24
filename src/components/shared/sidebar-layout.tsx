// src/components/shared/sidebar-layout.tsx
import type { ReactNode } from "react";

/**
 * Единый паттерн секции с боковой навигацией для всего приложения (/me, /admin
 * и будущие сайдбары). Один источник истины вида сайдбара.
 *
 * - Мобайл: обычная полоса над контентом (border-b), скроллится вместе со
 *   страницей — БЕЗ sticky и фона.
 * - Десктоп (lg): sticky вертикальная колонка слева (lg:sticky под шапкой),
 *   контент справа, логический разделитель `lg:border-e`.
 * - Без фона: на мобиле под навигацией ничего не скроллится (sticky-маска не
 *   нужна), на десктопе колонка стоит рядом с контентом. Бордер хребта рисуется
 *   поверх (layout.css spine-frame z-40), фон сайдбара его не перекрывает.
 *
 * `nav` — содержимое сайдбара (NavRail и опц. шапка секции, стопкой gap-4).
 * `children` — контент секции (свой паддинг задаёт потребитель).
 */
export const SIDEBAR_LAYOUT_CLASS = "flex flex-col lg:flex-row";

export const SIDEBAR_ASIDE_CLASS =
  "flex flex-col gap-4 border-b border-(--color-border) p-4 lg:w-56 lg:shrink-0 lg:self-start lg:sticky lg:top-(--layout-sticky-top) lg:border-b-0 lg:border-e";

export function SidebarLayout({
  nav,
  children,
}: {
  nav: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={SIDEBAR_LAYOUT_CLASS}>
      <aside className={SIDEBAR_ASIDE_CLASS}>{nav}</aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
