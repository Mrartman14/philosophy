"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  useActionState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import type { ActionResult } from "@/utils/create-action";
import type { Annotation } from "@/api/types";
import { AnnotationForm } from "./annotation-form";
import { deleteAnnotation, editAnnotation } from "./actions";

interface AnnotationHighlightProps {
  lectureId: string;
  annotations: Annotation[];
  annotationListContent: ReactNode;
}

export const AnnotationHighlight: React.FC<
  PropsWithChildren<AnnotationHighlightProps>
> = ({ lectureId, annotations, annotationListContent, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const listWrapperRef = useRef<HTMLDivElement>(null);
  const [selectedPositions, setSelectedPositions] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);

  // Map: position -> annotations that cover it
  const annotationsByPosition = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const a of annotations) {
      for (const pos of a.segment_ids ?? []) {
        const list = map.get(pos) ?? [];
        list.push(a);
        map.set(pos, list);
      }
    }
    return map;
  }, [annotations]);

  // Apply highlight classes via DOM side effect after each render
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const nodes = container.querySelectorAll<HTMLElement>("[data-position]");

    nodes.forEach((node) => {
      const pos = Number(node.dataset.position);
      const hasAnnotation =
        Number.isFinite(pos) && annotationsByPosition.has(pos);
      if (hasAnnotation) {
        node.setAttribute("data-has-annotation", "");
      } else {
        node.removeAttribute("data-has-annotation");
      }

      if (Number.isFinite(pos) && selectedPositions.includes(pos)) {
        node.setAttribute("data-annotation-selected", "");
      } else {
        node.removeAttribute("data-annotation-selected");
      }
    });
  }, [annotationsByPosition, selectedPositions, children]);

  // Filter the annotation list via DOM side effect. `annotationListContent`
  // is a pre-rendered server component (see page.tsx), so we can't pass a
  // `filterSegmentId` prop into it; instead we toggle the `hidden` attribute
  // on <li> elements whose `data-segment-ids` doesn't match the active filter.
  // This keeps a single rendering point (see P0-#3 in platform-bugfix plan).
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  useEffect(() => {
    const wrapper = listWrapperRef.current;
    if (!wrapper) return;
    const items = wrapper.querySelectorAll<HTMLElement>(
      "li[data-annotation-id]"
    );
    let shown = 0;
    items.forEach((li) => {
      if (activeFilter == null) {
        li.hidden = false;
        shown++;
        return;
      }
      const raw = li.dataset.segmentIds ?? "";
      const segmentIds = raw
        .split(",")
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
      const match = segmentIds.includes(activeFilter);
      li.hidden = !match;
      if (match) shown++;
    });
    setVisibleCount(activeFilter == null ? null : shown);
  }, [activeFilter, annotations, annotationListContent]);

  const applySelection = useCallback(
    (pos: number, withShift: boolean) => {
      setActiveFilter(null);
      if (withShift && selectedPositions.length > 0) {
        const last = selectedPositions[selectedPositions.length - 1] ?? pos;
        const from = Math.min(last, pos);
        const to = Math.max(last, pos);
        const range: number[] = [];
        for (let i = from; i <= to; i++) range.push(i);
        setSelectedPositions(range);
      } else {
        setSelectedPositions((prev) =>
          prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
        );
      }
    },
    [selectedPositions]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-position]"
      );
      if (!target) return;
      const pos = Number(target.dataset.position);
      if (!Number.isFinite(pos)) return;

      // Intercept when Alt is held (shortcut) OR when selection mode is active.
      const shouldIntercept = e.altKey || selectionMode;
      if (!shouldIntercept) return;
      e.preventDefault();
      e.stopPropagation();

      applySelection(pos, e.shiftKey);
    },
    [applySelection, selectionMode]
  );

  const handleMarkerClick = (pos: number) => {
    setActiveFilter((prev) => (prev === pos ? null : pos));
  };

  const clearSelection = () => {
    setSelectedPositions([]);
    setShowForm(false);
    setSelectionMode(false);
  };

  // Show marker clicks via delegated click when marker element is clicked
  const handleMarkerDelegated = (e: React.MouseEvent<HTMLDivElement>) => {
    const marker = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-annotation-marker]"
    );
    if (!marker) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = Number(marker.dataset.annotationMarker);
    if (Number.isFinite(pos)) handleMarkerClick(pos);
  };

  const hasSelection = selectedPositions.length > 0;
  const showEmptyFilterMessage =
    activeFilter != null && visibleCount === 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-2">
        <div className="text-xs text-(--color-description)">
          {selectionMode
            ? "Режим выбора: кликайте по сегментам (Shift+клик — диапазон)"
            : "Alt+клик — выбрать сегмент, Alt+Shift+клик — диапазон"}
        </div>
        {!selectionMode && !hasSelection && !showForm && (
          <button
            type="button"
            onClick={() => setSelectionMode(true)}
            className="text-xs px-2 py-1 rounded border border-(--color-border) hover:bg-(--color-border)/30"
          >
            Создать аннотацию
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        onClickCapture={(e) => {
          handleMarkerDelegated(e);
          handleClick(e);
        }}
        className="[&_[data-has-annotation]]:border-l-2 [&_[data-has-annotation]]:border-(--color-primary)/60 [&_[data-annotation-selected]]:bg-(--color-primary)/20"
      >
        {children}
      </div>

      {(selectionMode || hasSelection) && !showForm && (
        <div className="sticky bottom-0 flex items-center justify-between gap-2 p-3 border-t border-(--color-border) bg-(--color-text-pane)">
          <span className="text-xs">
            {hasSelection
              ? `Выбрано сегментов: ${selectedPositions.length}`
              : "Кликните по сегменту, чтобы начать выбор"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm rounded border border-(--color-border) hover:bg-(--color-border)/30"
            >
              Отменить
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              disabled={!hasSelection}
              className="px-3 py-1.5 text-sm rounded bg-(--color-primary) text-white hover:opacity-90 disabled:opacity-50"
            >
              Готово
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="p-3 border-t border-(--color-border)">
          <AnnotationForm
            lectureId={lectureId}
            selectedSegmentIds={selectedPositions}
            onSuccess={clearSelection}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="border-t border-(--color-border)">
        <div className="flex items-center justify-between p-4 pb-0">
          <h2 className="text-sm font-semibold">
            Аннотации
            {activeFilter != null && (
              <span className="ml-2 text-xs text-(--color-description)">
                (сегмент #{activeFilter + 1}
                {visibleCount != null ? `, ${visibleCount}` : ""})
              </span>
            )}
          </h2>
          {activeFilter != null && (
            <button
              type="button"
              onClick={() => setActiveFilter(null)}
              className="text-xs text-(--color-primary) hover:underline"
            >
              Сбросить фильтр
            </button>
          )}
        </div>
        {/*
         * P0-#3: Single rendering point. We no longer render a duplicate <ul>
         * here when a filter is active. Instead, the useEffect above toggles
         * the `hidden` attribute on <li data-annotation-id> elements rendered
         * by AnnotationList, so edit/delete UI and status badges remain
         * available (see P0-#2 in annotation-list.tsx).
         */}
        <div ref={listWrapperRef}>{annotationListContent}</div>
        {showEmptyFilterMessage && (
          <p className="text-sm text-(--color-description) p-4">
            Нет аннотаций к этому сегменту.
          </p>
        )}
      </div>
    </div>
  );
};

interface AnnotationItemActionsProps {
  annotationId: string;
  lectureId: string;
  initialBody: string;
  initialSegmentIds: number[];
  canEdit: boolean;
  canDelete: boolean;
}

const editInitialState: ActionResult<Annotation> = {
  success: false,
  error: "",
};

/**
 * Inline edit/delete controls for a single annotation item.
 *
 * Lives here (instead of in a separate client file) because this group's
 * edit access is scoped to `annotation-highlight.tsx` and `annotation-list.tsx`
 * only (see docs/plans/2026-04-09-platform-bugfix-plan.md, Group A).
 */
export const AnnotationItemActions: React.FC<AnnotationItemActionsProps> = ({
  annotationId,
  lectureId,
  initialBody,
  initialSegmentIds,
  canEdit,
  canDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [state, formAction, isSaving] = useActionState(
    editAnnotation,
    editInitialState
  );

  // Close the edit form after a successful save. We use the "storing
  // information from previous renders" pattern so we only react to a fresh
  // state object (see https://react.dev/reference/react/useState). This
  // avoids both setState-in-effect and ref-access-in-render lint violations.
  const [previousState, setPreviousState] = useState(state);
  if (state !== previousState) {
    setPreviousState(state);
    if (state.success && isEditing) {
      setIsEditing(false);
    }
  }

  if (!canEdit && !canDelete) return null;

  const handleDelete = () => {
    if (!confirm("Удалить аннотацию?")) return;
    startDeleteTransition(async () => {
      setDeleteError(null);
      const result = await deleteAnnotation({
        annotationId,
        lectureId,
      });
      if (!result.success) {
        setDeleteError(result.error);
      }
    });
  };

  if (isEditing) {
    return (
      <form
        action={formAction}
        className="flex flex-col gap-2 mt-1 p-2 border border-(--color-border) rounded-md bg-(--color-text-pane)"
      >
        <input type="hidden" name="annotation_id" value={annotationId} />
        <input type="hidden" name="lecture_id" value={lectureId} />
        <input
          type="hidden"
          name="segment_ids"
          value={initialSegmentIds.join(",")}
        />
        <textarea
          name="body"
          required
          minLength={1}
          maxLength={10000}
          rows={3}
          defaultValue={initialBody}
          className="w-full p-2 rounded border border-(--color-border) bg-transparent text-sm resize-y"
          disabled={isSaving}
        />
        {!state.success && state.error && (
          <p role="alert" className="text-xs text-red-500">
            {state.error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={isSaving}
            className="text-xs px-3 py-1 rounded border border-(--color-border) hover:bg-(--color-border)/30 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="text-xs px-3 py-1 rounded bg-(--color-primary) text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      {canEdit && (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-xs text-(--color-description) hover:text-(--color-link) transition-colors"
        >
          Изменить
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-xs text-(--color-description) hover:text-red-500 transition-colors disabled:opacity-50"
        >
          {isDeleting ? "Удаление..." : "Удалить"}
        </button>
      )}
      {deleteError && (
        <span role="alert" className="text-xs text-red-500">
          {deleteError}
        </span>
      )}
    </div>
  );
};
