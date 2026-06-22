"use client";
// src/features/trails/ui/trail-items-editor.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { DocumentPicker } from "@/components/ast-editor/pickers/document-picker";
import { Button, IdempotencyField, Inline, SubmitButton, Form, useToast, VersionField } from "@/components/ui";
// DocumentPicker — client-компонент из @/components (НЕ cross-feature). В index.ts
// ast-editor он не реэкспортнут, поэтому импортируем напрямую.
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { setTrailItems } from "../actions";
import type { TrailWithItems, TrailDocumentSummary } from "../types";

const initial = initialActionState<TrailWithItems | null>(null);

interface Props {
  trailId: string;
  /** Версия маршрута для optimistic lock (If-Match). */
  trailVersion?: number | undefined;
  /** Текущие элементы в порядке (id + резолвнутое имя файла). */
  initialItems: TrailDocumentSummary[];
}

export function TrailItemsEditor({ trailId, trailVersion, initialItems }: Props) {
  const router = useRouter();
  const t = useT("trails");
  const tErrors = useT("errors");
  const toast = useToast();
  const [items, setItems] = useState<TrailDocumentSummary[]>(initialItems);
  const [picking, setPicking] = useState(false);
  const [state, action] = useActionState(setTrailItems, initial);

  // После успешного сохранения — рефреш страницы (порядок/состав на беке).
  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: t("itemsSavedTitle"), description: t("itemsSavedDescription") });
      router.refresh();
    }
  }, [state, router, toast, t]);

  useEffect(() => {
    if (!state.success && !state.code) {
      toast.add({ title: t("itemsErrorTitle"), description: state.error });
    }
  }, [state, toast, t]);

  function addDocument(id: string, filename: string) {
    setPicking(false);
    if (items.some((it) => it.id === id)) {
      toast.add({ title: t("itemsAlreadyAddedTitle"), description: t("itemsAlreadyAddedDescription") });
      return;
    }
    setItems((prev) => [...prev, { id, filename }]);
  }

  function removeAt(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const [moved] = next.splice(index, 1);
      if (!moved) return prev;
      next.splice(target, 0, moved);
      return next;
    });
  }

  const orderedIds = items.map((it) => it.id);

  return (
    <section className="flex flex-col gap-4 rounded border border-(--color-border) p-4">
      <h2 className="text-lg font-semibold">{t("itemsHeading")}</h2>

      {items.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{t("itemsEmpty")}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded border border-(--color-border) px-2 py-1.5"
            >
              <span className="text-sm">
                {index + 1}. {item.filename}
              </span>
              <span className="flex items-center gap-1">
                <Button
                  type="button"
                  tone="quiet"
                  compact
                  disabled={index === 0}
                  aria-label={t("itemsMoveUp")}
                  onClick={() => { move(index, -1); }}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  tone="quiet"
                  compact
                  disabled={index === items.length - 1}
                  aria-label={t("itemsMoveDown")}
                  onClick={() => { move(index, 1); }}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  tone="danger"
                  compact
                  aria-label={t("itemsRemove")}
                  onClick={() => { removeAt(index); }}
                >
                  ✕
                </Button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {picking ? (
        <div className="rounded border border-(--color-border) p-2">
          <DocumentPicker onSelect={addDocument} />
          <Button type="button" tone="quiet" compact onClick={() => { setPicking(false); }}>
            {t("itemsPickerCancel")}
          </Button>
        </div>
      ) : (
        <Button type="button" tone="neutral" compact onClick={() => { setPicking(true); }}>
          {t("itemsAddDocument")}
        </Button>
      )}

      <Form action={action}>
        <Inline align="center">
          <input type="hidden" name="id" value={trailId} />
          <VersionField version={trailVersion} />
          <input type="hidden" name="document_ids" value={JSON.stringify(orderedIds)} />
          <IdempotencyField result={state} />
          <SubmitButton>{t("itemsSaveSubmit")}</SubmitButton>
          {!state.success && state.code === "forbidden" && (
            <span className="text-sm text-(--color-danger)">
              {tErrors("forbiddenAction", { action: t("itemsForbiddenAction") })}
            </span>
          )}
          {!state.success && state.code === "validation" && (
            <span className="text-sm text-(--color-danger)">{t("itemsValidationError")}</span>
          )}
        </Inline>
      </Form>
    </section>
  );
}
