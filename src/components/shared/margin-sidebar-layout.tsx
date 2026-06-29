// src/components/shared/margin-sidebar-layout.tsx
import type { ReactNode } from "react";

/**
 * Секция с нав-сайдбаром в ЛЕВОМ ПОЛЕ (margin-nav). Альтернатива SidebarLayout:
 * - SidebarLayout — нав ВО ФЛОУ, внутри хребта (делит ширину с контентом).
 * - MarginSidebarLayout — когда поля раскрыты (широкий контейнер), нав уходит в
 *   левое ПОЛЕ (sticky под шапкой) → контент занимает ВЕСЬ хребет; на узком
 *   контейнере нав падает полосой сверху в хребте.
 *
 * Раскладка/responsive — в классе `.margin-nav` (layout.css).
 *
 * ВАЖНО: возвращает фрагмент — `nav` и контент становятся ПРЯМЫМИ потомками
 * `.page-grid` (корневой <main>), иначе именованные грид-линии `.margin-nav` не
 * сошлются. Поэтому секция-layout должна рендерить его прямо в {children} (без
 * собственных обёрток-div вокруг).
 *
 * `nav` — содержимое сайдбара (NavRail и опц. шапка секции).
 * `children` — контент секции (свой паддинг задаёт потребитель).
 */
export function MarginSidebarLayout({
  nav,
  children,
}: {
  nav: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <aside className="margin-nav">{nav}</aside>
      <div className="min-w-0">{children}</div>
    </>
  );
}
