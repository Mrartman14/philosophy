// src/components/attachments/types.ts
import type { ReactNode } from "react";

/**
 * Доменно-нейтральный элемент прикрепления. Слайс-потребитель мапит свой
 * attachment.AttachmentDTO в этот контракт. Доменных полей быть не должно.
 */
export interface AttachmentItem {
  /** Стабильный ключ строки (обычно entity_id или составной ключ). */
  id: string;
  /** Заголовок для показа (имя лекции-контейнера или имя сущности). */
  label: string;
  /** Порядковый номер (sort_order бекенда). Для сортировки и reorder. */
  sortOrder: number;
  /** Ссылка на элемент (опц.) — например на страницу лекции. */
  href?: string;
  /**
   * Тип сущности ("document" | "media" | "canvas" | …). Нужен для graceful
   * fallback-плашки (например canvas в волне 2 рендерим плашкой).
   */
  entityType?: string;
}

/**
 * Результат пользовательского действия. Потребитель оборачивает свой server
 * action и возвращает наружу `{ ok }` + опц. текст ошибки для тоста.
 */
export type AttachmentActionResult =
  | { ok: true }
  | { ok: false; error: string };

export interface AttachTargetPickerProps {
  /**
   * Фетчер целевых сущностей для AsyncCombobox. Стабильная ссылка
   * (useCallback) рекомендуется. Возвращает страницу результатов.
   */
  fetcher: (q: string, offset: number, limit: number) => Promise<{
    data: { id: string; label: string }[];
    total: number | null;
  }>;
  /** Вызывается при выборе цели. */
  onSelect: (id: string, label: string) => void;
  /** Закрытие пикера (Esc / отмена). */
  onClose?: () => void;
  placeholder?: string;
}

export interface AttachmentsPanelProps {
  /** Заголовок секции. */
  title?: string;
  /** Текущие прикрепления (в любом порядке — компонент сортирует по sortOrder). */
  items: AttachmentItem[];
  /** Текст при пустом списке. */
  emptyText?: string;
  className?: string;

  /**
   * Режим управления. Когда false (read-only) — рендерится только список,
   * без кнопок detach/reorder/attach. На странице документа волны 2 — false.
   */
  canManage?: boolean;

  /**
   * Можно ли прикреплять новые (attach). На беке = entity.attach ∧ ownership
   * лекции. Потребитель вычисляет boolean на сервере и передаёт сюда. Если
   * false — кнопка «Прикрепить» не рендерится (detach/reorder остаются по
   * canManage). См. §6.3 спеки.
   */
  canAttach?: boolean;

  /** Detach. Обязателен, если canManage. */
  onDetach?: (item: AttachmentItem) => Promise<AttachmentActionResult>;
  /**
   * Reorder: новое значение sortOrder для элемента. Обязателен, если canManage.
   * Компонент вызывает при «вверх/вниз», передавая целевой sortOrder.
   */
  onReorder?: (item: AttachmentItem, newSortOrder: number) => Promise<AttachmentActionResult>;
  /** Attach выбранной цели. Обязателен, если canAttach. */
  onAttach?: (targetId: string, targetLabel: string) => Promise<AttachmentActionResult>;

  /**
   * Рендер-проп пикера цели (для attach). Потребитель прокидывает свой
   * AttachTargetPicker, сконфигурированный нужным fetcher'ом. Компонент
   * передаёт onSelect/onClose. Обязателен, если canAttach.
   */
  renderTargetPicker?: (props: {
    onSelect: (id: string, label: string) => void;
    onClose: () => void;
  }) => ReactNode;

  /**
   * Сообщение об ошибке action'а показывается локально под списком. Если
   * потребитель предпочитает тост — может игнорировать встроенный показ
   * (компонент всё равно вернёт результат в onX).
   */
}
