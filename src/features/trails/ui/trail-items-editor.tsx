"use client";
// src/features/trails/ui/trail-items-editor.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { DocumentPicker } from "@/components/ast-editor/pickers/document-picker";
import { Button, SubmitButton, Form, useToast } from "@/components/ui";
// DocumentPicker — client-компонент из @/components (НЕ cross-feature). В index.ts
// ast-editor он не реэкспортнут, поэтому импортируем напрямую.
import type { ActionResult } from "@/utils/create-action";

import { setTrailItems } from "../actions";
import type { TrailWithItems, TrailDocumentSummary } from "../types";

const initial: ActionResult<TrailWithItems | null> = { success: true, data: null };

interface Props {
  trailId: string;
  /** Версия маршрута для optimistic lock (If-Match). */
  trailVersion?: number | undefined;
  /** Текущие элементы в порядке (id + резолвнутое имя файла). */
  initialItems: TrailDocumentSummary[];
}

export function TrailItemsEditor({ trailId, trailVersion, initialItems }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<TrailDocumentSummary[]>(initialItems);
  const [picking, setPicking] = useState(false);
  const [state, action] = useActionState(setTrailItems, initial);

  // После успешного сохранения — рефреш страницы (порядок/состав на беке).
  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: "Сохранено", description: "Содержимое маршрута обновлено." });
      router.refresh();
    }
  }, [state, router, toast]);

  useEffect(() => {
    if (!state.success && !state.code) {
      toast.add({ title: "Ошибка", description: state.error });
    }
  }, [state, toast]);

  function addDocument(id: string, filename: string) {
    setPicking(false);
    if (items.some((it) => it.id === id)) {
      toast.add({ title: "Уже добавлен", description: "Этот документ уже в маршруте." });
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
      <h2 className="text-lg font-semibold">Содержимое маршрута</h2>

      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">Маршрут пуст. Добавьте документы.</p>
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
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  aria-label="Вверх"
                  onClick={() => { move(index, -1); }}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === items.length - 1}
                  aria-label="Вниз"
                  onClick={() => { move(index, 1); }}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  aria-label="Убрать"
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
          <Button type="button" variant="ghost" size="sm" onClick={() => { setPicking(false); }}>
            Отмена
          </Button>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => { setPicking(true); }}>
          + Добавить документ
        </Button>
      )}

      <Form action={action} className="flex items-center gap-2">
        <input type="hidden" name="id" value={trailId} />
        <input type="hidden" name="version" value={String(trailVersion ?? "")} />
        <input type="hidden" name="document_ids" value={JSON.stringify(orderedIds)} />
        <SubmitButton>Сохранить содержимое</SubmitButton>
        {!state.success && state.code === "forbidden" && (
          <span className="text-sm text-red-600">У вас нет прав на изменение маршрута.</span>
        )}
        {!state.success && state.code === "validation" && (
          <span className="text-sm text-red-600">Проверьте список документов.</span>
        )}
      </Form>
    </section>
  );
}
