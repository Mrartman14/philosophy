"use client";
import { useCallback } from "react";
import {
  AttachmentsPanel,
  AttachTargetPicker,
} from "@/components/attachments";
import type {
  AttachmentItem,
  AttachmentActionResult,
} from "@/components/attachments";
import {
  attachToLecture,
  detachFromLecture,
  reorderLectureAttachment,
} from "../actions";

/** Минимальная форма прикреплённой сущности для панели (id+label+type). */
export interface ManagedAttachment {
  entityId: string;
  entityType: "document" | "media" | "canvas";
  label: string;
  sortOrder: number;
}

interface Props {
  lectureId: string;
  /** Уже прикреплённые document+media (собраны на сервере из списков). */
  attachments: ManagedAttachment[];
  /** entity.attach ∧ ownership (вычислено на сервере). */
  canAttach: boolean;
  /** Тип прикрепляемых сущностей для пикера (документы или медиа). */
  pickerEntityType: "document" | "media";
  /** Fetcher целей для AsyncCombobox (server action, переданный страницей). */
  targetFetcher: (
    q: string,
    offset: number,
    limit: number,
  ) => Promise<{ data: { id: string; label: string }[]; total: number | null }>;
  title: string;
}

/**
 * Адаптер generic-панели прикреплений (@/components/attachments) под лекцию.
 * Маппит ManagedAttachment → AttachmentItem, оборачивает server actions в
 * { ok } -контракт панели (с branded-текстом для forbidden). detach/reorder —
 * по ownership (canManage всегда true на admin-странице, гейт выше); attach —
 * по canAttach. entity_type=canvas рендерит плашку сама панель.
 */
export function LectureAttachmentsManager({
  lectureId,
  attachments,
  canAttach,
  pickerEntityType,
  targetFetcher,
  title,
}: Props) {
  const items: AttachmentItem[] = attachments.map((a) => ({
    id: `${a.entityType}:${a.entityId}`,
    label: a.label,
    sortOrder: a.sortOrder,
    ...(a.entityType === "document"
      ? { href: `/documents/${a.entityId}` }
      : a.entityType === "media"
        ? { href: `/media/${a.entityId}` }
        : {}),
    entityType: a.entityType,
  }));

  // Восстанавливаем entityType/entityId из составного id панели.
  function split(id: string): {
    entityType: "document" | "media" | "canvas";
    entityId: string;
  } {
    const idx = id.indexOf(":");
    return {
      entityType: id.slice(0, idx) as "document" | "media" | "canvas",
      entityId: id.slice(idx + 1),
    };
  }

  const onDetach = useCallback(
    async (item: AttachmentItem): Promise<AttachmentActionResult> => {
      const { entityType, entityId } = split(item.id);
      const r = await detachFromLecture({
        lecture_id: lectureId,
        entity_id: entityId,
        entity_type: entityType,
      });
      if (r.success) return { ok: true };
      return {
        ok: false,
        error:
          r.code === "forbidden" ? "У вас нет прав на открепление." : r.error,
      };
    },
    [lectureId],
  );

  const onReorder = useCallback(
    async (
      item: AttachmentItem,
      newSortOrder: number,
    ): Promise<AttachmentActionResult> => {
      const { entityType, entityId } = split(item.id);
      const r = await reorderLectureAttachment({
        lecture_id: lectureId,
        entity_id: entityId,
        entity_type: entityType,
        sort_order: newSortOrder,
      });
      if (r.success) return { ok: true };
      return {
        ok: false,
        error:
          r.code === "forbidden"
            ? "У вас нет прав на изменение порядка."
            : r.error,
      };
    },
    [lectureId],
  );

  const onAttach = useCallback(
    async (targetId: string): Promise<AttachmentActionResult> => {
      const r = await attachToLecture({
        lecture_id: lectureId,
        entity_id: targetId,
        entity_type: pickerEntityType,
      });
      if (r.success) return { ok: true };
      return {
        ok: false,
        error:
          r.code === "forbidden" ? "У вас нет прав на прикрепление." : r.error,
      };
    },
    [lectureId, pickerEntityType],
  );

  return (
    <AttachmentsPanel
      title={title}
      items={items}
      canManage
      canAttach={canAttach}
      onDetach={onDetach}
      onReorder={onReorder}
      onAttach={onAttach}
      renderTargetPicker={({ onSelect, onClose }) => (
        <AttachTargetPicker
          fetcher={targetFetcher}
          onSelect={onSelect}
          onClose={onClose}
          placeholder={
            pickerEntityType === "document" ? "Поиск документа…" : "Поиск медиа…"
          }
        />
      )}
      emptyText="Пока ничего не прикреплено."
    />
  );
}
