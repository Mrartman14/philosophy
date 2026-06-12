// src/components/revision-history/types.ts
import type { ReactNode } from "react";

/**
 * Доменно-нейтральный элемент списка ревизий.
 * Слайс мапит свой тип (например revision.RevisionMeta из @/api/schema)
 * в этот контракт. Доменных полей здесь быть не должно.
 */
export interface RevisionListItem {
  /** Уникальный id ревизии (ключ списка и аргумент buildHref). */
  id: string;
  /** ISO-8601 datetime создания снапшота — рендерится локализованно (ru-RU, UTC). */
  createdAt: string;
  /** Опциональная подпись (username редактора, номер версии и т. п.). */
  label?: string;
}

export interface RevisionHistoryProps {
  /**
   * Ревизии в порядке отображения (новые первыми). Бек отдаёт список
   * в порядке created_at ASC (старые первыми) — слайс переворачивает его
   * в своём мостике перед передачей сюда.
   */
  revisions: RevisionListItem[];
  /** id выбранной ревизии (обычно из searchParams страницы). */
  selectedId?: string;
  /**
   * Строит href ссылки выбора ревизии. Роутингом владеет слайс:
   * например (rid) => `/admin/events/${eventId}/edit?revision=${rid}`.
   * Компонент серверный (без "use client") — функция-проп безопасна и при
   * использовании из server components, и внутри полностью клиентских
   * деревьев. НЕЛЬЗЯ передавать эту функцию через server→client границу.
   */
  buildHref: (revisionId: string) => string;
  /**
   * Контент выбранной ревизии. Слайс сам фетчит снапшот через свой api.ts
   * и рендерит (обычно <AstRender blocks={…} />). Панель показывается
   * только когда заданы и selectedId, и children.
   */
  children?: ReactNode;
  /** Заголовок секции. По умолчанию «История ревизий». */
  title?: string;
  /** Текст при пустом списке. По умолчанию «Ревизий пока нет.». */
  emptyText?: string;
  className?: string;
}
