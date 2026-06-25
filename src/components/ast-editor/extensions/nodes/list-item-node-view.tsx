"use client";
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";

import { useT } from "@/i18n/client";

/**
 * Живой nodeView пункта списка. Для задачи (checked != null) рисует ИНТЕРАКТИВНЫЙ
 * чекбокс (статичный disabled-вариант из общей карты годится только для read/SSR).
 * Структура повторяет карту: <li data-checked><input><div class="task-content">.
 * Обычный пункт — контент напрямую (маркер из CSS), без чекбокса.
 */
export function ListItemNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const t = useT("editor");
  const checked = node.attrs.checked as boolean | null;
  const isTask = typeof checked === "boolean";

  if (!isTask) {
    return (
      <NodeViewWrapper as="li">
        <NodeViewContent as="div" className="list-item-content" />
      </NodeViewWrapper>
    );
  }

  // isTask — aliased type guard: TS сузил checked до boolean (не null).
  return (
    <NodeViewWrapper as="li" data-checked={checked ? "true" : "false"}>
      <input
        type="checkbox"
        checked={checked}
        disabled={!editor.isEditable}
        contentEditable={false}
        aria-label={t("checkListItem")}
        // mousedown не должен уводить выделение PM в чекбокс-виджет.
        onMouseDown={(e) => { e.stopPropagation(); }}
        onChange={() => { updateAttributes({ checked: !checked }); }}
      />
      <NodeViewContent as="div" className="task-content" />
    </NodeViewWrapper>
  );
}
