// src/components/attachments/attachments-panel.tsx
"use client";
import { useMemo, useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { AttachmentsPanelProps } from "./types";

/**
 * Доменно-нейтральная панель прикреплений: список (сортировка по sortOrder),
 * detach, reorder (вверх/вниз обменом sortOrder с соседом), attach через
 * рендер-проп пикера. Все данные и actions — пропами. Не знает о документах /
 * медиа / лекциях. Переиспользуется documents (read-only), lecture-enrichment
 * и media (волна 3).
 */
export function AttachmentsPanel({
  title,
  items,
  emptyText,
  className,
  canManage = false,
  canAttach = false,
  onDetach,
  onReorder,
  onAttach,
  renderTargetPicker,
}: AttachmentsPanelProps) {
  const t = useT("common");
  const resolvedTitle = title ?? t("attachments.title");
  const resolvedEmptyText = emptyText ?? t("attachments.empty");

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
      if (!r.ok) setError(r.error ?? t("attachments.operationError"));
    });
  }

  const showAttach = canManage && canAttach && Boolean(onAttach) && Boolean(renderTargetPicker);

  return (
    <section className={className} aria-label={resolvedTitle}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{resolvedTitle}</h2>
        {showAttach && (
          <Button
            variant="secondary"
            compact
            onClick={() => { setPickerOpen((v) => !v); }}
            disabled={pending}
          >
            {t("attachments.attach")}
          </Button>
        )}
      </div>

      {pickerOpen && showAttach && renderTargetPicker && (
        <div className="mt-2">
          {renderTargetPicker({
            onSelect: (id, label) => {
              setPickerOpen(false);
              if (onAttach) run(() => onAttach(id, label));
            },
            onClose: () => { setPickerOpen(false); },
          })}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-(--color-fg-muted)">{resolvedEmptyText}</p>
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
                  <span className="ml-2 text-xs text-(--color-fg-muted)">
                    {t("attachments.canvasNoPreview")}
                  </span>
                )}
              </span>
              {canManage && (
                <span className="flex items-center gap-1">
                  {onReorder && i > 0 && (
                    <IconButton
                      aria-label={t("attachments.moveUp")}
                      compact
                      className="text-sm"
                      disabled={pending}
                      onClick={() => {
                        const prev = sorted[i - 1];
                        if (prev === undefined) return;
                        run(() => onReorder(item, prev.sortOrder));
                      }}
                    >
                      ↑
                    </IconButton>
                  )}
                  {onReorder && i < sorted.length - 1 && (
                    <IconButton
                      aria-label={t("attachments.moveDown")}
                      compact
                      className="text-sm"
                      disabled={pending}
                      onClick={() => {
                        const next = sorted[i + 1];
                        if (next === undefined) return;
                        run(() => onReorder(item, next.sortOrder));
                      }}
                    >
                      ↓
                    </IconButton>
                  )}
                  {onDetach && (
                    <Button
                      variant="secondary"
                      compact
                      disabled={pending}
                      onClick={() => { run(() => onDetach(item)); }}
                    >
                      {t("attachments.detach")}
                    </Button>
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
