"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import type { Annotation } from "@/api/types";
import { AnnotationForm } from "./annotation-form";

interface AnnotationHighlightProps {
  lectureId: string;
  annotations: Annotation[];
  annotationListContent: ReactNode;
}

export const AnnotationHighlight: React.FC<
  PropsWithChildren<AnnotationHighlightProps>
> = ({ lectureId, annotations, annotationListContent, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPositions, setSelectedPositions] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<number | null>(null);

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

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-position]"
      );
      if (!target) return;
      const pos = Number(target.dataset.position);
      if (!Number.isFinite(pos)) return;

      // Only intercept clicks when Alt key is held (otherwise let seek work)
      if (!e.altKey) return;
      e.preventDefault();
      e.stopPropagation();

      setActiveFilter(null);

      if (e.shiftKey && selectedPositions.length > 0) {
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

  const filteredAnnotations = useMemo(() => {
    if (activeFilter == null) return annotations;
    return annotations.filter((a) =>
      (a.segment_ids ?? []).includes(activeFilter)
    );
  }, [annotations, activeFilter]);

  const handleMarkerClick = (pos: number) => {
    setActiveFilter((prev) => (prev === pos ? null : pos));
  };

  const clearSelection = () => {
    setSelectedPositions([]);
    setShowForm(false);
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

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-2 text-xs text-(--color-description)">
        Alt+клик — выбрать сегмент, Alt+Shift+клик — диапазон
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

      {selectedPositions.length > 0 && !showForm && (
        <div className="sticky bottom-0 flex items-center justify-between gap-2 p-3 border-t border-(--color-border) bg-(--color-text-pane)">
          <span className="text-xs">
            Выбрано сегментов: {selectedPositions.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm rounded border border-(--color-border) hover:bg-(--color-border)/30"
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-3 py-1.5 text-sm rounded bg-(--color-primary) text-white hover:opacity-90"
            >
              Добавить аннотацию
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
                (сегмент #{activeFilter + 1})
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
        {activeFilter == null ? (
          annotationListContent
        ) : (
          <ul className="flex flex-col gap-3 p-4">
            {filteredAnnotations.map((a) => (
              <li
                key={a.id}
                className="border border-(--color-border) rounded-lg p-3"
              >
                <div className="text-xs font-medium mb-1">
                  {a.is_anonymous ? "Аноним" : a.author?.username ?? "Аноним"}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {a.body}
                </p>
              </li>
            ))}
            {filteredAnnotations.length === 0 && (
              <li className="text-sm text-(--color-description)">
                Нет аннотаций к этому сегменту.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};
