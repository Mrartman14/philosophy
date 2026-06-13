// src/components/attachments/attachments-panel.tsx
"use client";
import { useMemo, useState, useTransition } from "react";
import type { AttachmentsPanelProps } from "./types";

/**
 * Доменно-нейтральная панель прикреплений: список (сортировка по sortOrder),
 * detach, reorder (вверх/вниз обменом sortOrder с соседом), attach через
 * рендер-проп пикера. Все данные и actions — пропами. Не знает о документах /
 * медиа / лекциях. Переиспользуется documents (read-only), lecture-enrichment
 * и media (волна 3).
 */
export function AttachmentsPanel({
  title = "Прикрепления",
  items,
  emptyText = "Пока ничего не прикреплено.",
  className,
  canManage = false,
  canAttach = false,
  onDetach,
  onReorder,
  onAttach,
  renderTargetPicker,
}: AttachmentsPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Ошибка операции");
    });
  }

  const showAttach = canManage && canAttach && Boolean(onAttach) && Boolean(renderTargetPicker);

  return (
    <section className={className} aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {showAttach && (
          <button
            type="button"
            className="rounded border border-(--color-border) px-2 py-1 text-sm hover:bg-(--color-text-pane)"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={pending}
          >
            Прикрепить
          </button>
        )}
      </div>

      {pickerOpen && showAttach && renderTargetPicker && (
        <div className="mt-2">
          {renderTargetPicker({
            onSelect: (id, label) => {
              setPickerOpen(false);
              if (onAttach) run(() => onAttach(id, label));
            },
            onClose: () => setPickerOpen(false),
          })}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-(--color-description)">{emptyText}</p>
      ) : (
        <ol className="mt-2 flex flex-col divide-y divide-(--color-border)">
          {sorted.map((item, i) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-1.5">
              <span data-testid="attachment-label" className="text-sm">
                {item.href ? (
                  <a href={item.href} className="hover:underline">
                    {item.label}
                  </a>
                ) : (
                  item.label
                )}
                {item.entityType === "canvas" && (
                  <span className="ml-2 text-xs text-(--color-description)">
                    (canvas — просмотр недоступен)
                  </span>
                )}
              </span>
              {canManage && (
                <span className="flex items-center gap-1">
                  {onReorder && i > 0 && (
                    <button
                      type="button"
                      aria-label="Выше"
                      className="rounded px-1 text-sm hover:bg-(--color-text-pane)"
                      disabled={pending}
                      onClick={() => {
                        const prev = sorted[i - 1]!;
                        run(() => onReorder(item, prev.sortOrder));
                      }}
                    >
                      ↑
                    </button>
                  )}
                  {onReorder && i < sorted.length - 1 && (
                    <button
                      type="button"
                      aria-label="Ниже"
                      className="rounded px-1 text-sm hover:bg-(--color-text-pane)"
                      disabled={pending}
                      onClick={() => {
                        const next = sorted[i + 1]!;
                        run(() => onReorder(item, next.sortOrder));
                      }}
                    >
                      ↓
                    </button>
                  )}
                  {onDetach && (
                    <button
                      type="button"
                      className="rounded border border-(--color-border) px-2 py-0.5 text-sm hover:bg-(--color-text-pane)"
                      disabled={pending}
                      onClick={() => run(() => onDetach(item))}
                    >
                      Открепить
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
