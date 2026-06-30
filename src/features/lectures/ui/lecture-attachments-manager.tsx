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
import { useT } from "@/i18n/client";

import {
  attachToLecture,
  detachFromLecture,
  reorderLectureAttachment,
} from "../actions";
import type { AttachmentEntityType } from "../types";

/** Минимальная форма прикреплённой сущности для панели (id+label+type). */
export interface ManagedAttachment {
  entityId: string;
  entityType: AttachmentEntityType;
  label: string;
  sortOrder: number;
}

interface Props {
  lectureId: string;
  /** Уже прикреплённые document+media (собраны на сервере из списков). */
  attachments: ManagedAttachment[];
  /** entity.attach ∧ ownership (вычислено на сервере). */
  canAttach: boolean;
  /** Тип прикрепляемых сущностей для пикера (документы, медиа или формы). */
  pickerEntityType: "document" | "media" | "form";
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
  const tL = useT("lectures");

  const items: AttachmentItem[] = attachments.map((a) => ({
    id: `${a.entityType}:${a.entityId}`,
    label: a.label,
    sortOrder: a.sortOrder,
    ...(a.entityType === "document"
      ? { href: `/documents/${a.entityId}` }
      : a.entityType === "media"
        ? { href: `/media/${a.entityId}` }
        : a.entityType === "form"
          ? { href: `/forms/${a.entityId}` }
          : {}),
    entityType: a.entityType,
  }));

  // Восстанавливаем entityType/entityId из составного id панели.
  function split(id: string): {
    entityType: AttachmentEntityType;
    entityId: string;
  } {
    const idx = id.indexOf(":");
    return {
      entityType: id.slice(0, idx) as AttachmentEntityType,
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
          r.code === "forbidden" ? tL("detachForbidden") : r.error,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          r.code === "forbidden" ? tL("reorderForbidden") : r.error,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          r.code === "forbidden" ? tL("attachForbidden") : r.error,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            pickerEntityType === "document"
              ? tL("searchDocumentPlaceholder")
              : pickerEntityType === "media"
                ? tL("searchMediaPlaceholder")
                : tL("searchFormPlaceholder")
          }
        />
      )}
      emptyText={tL("attachmentsEmpty")}
    />
  );
}
