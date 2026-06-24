// src/components/ast-editor/caret-anchor.ts
import type { Editor } from "@tiptap/core";

/**
 * Virtual-anchor для Base UI `Popover.Positioner`: прямоугольник каретки в
 * координатах вьюпорта (ProseMirror `coordsAtPos`). Позволяет якорить floating-меню
 * (slash/@) под курсор, переиспользуя позиционирование/портал/коллизии Base UI
 * (floating-ui) вместо ручной геометрии — тот же приём, что у тулбарного RefPopover,
 * только якорь не DOM-элемент, а позиция в документе.
 *
 * `from` клампится в валидный диапазон дока, а `coordsAtPos` обёрнут в try/catch:
 * между закрытием меню и удалением "@"/"/"-маркера позиция может стать невалидной —
 * тогда возвращаем нулевой rect, floating-ui переразместит при следующем замере.
 */
export function caretVirtualElement(editor: Editor, from: number) {
  return {
    getBoundingClientRect: (): DOMRect => {
      try {
        const size = editor.view.state.doc.content.size;
        const pos = Math.max(0, Math.min(from, size));
        const c = editor.view.coordsAtPos(pos);
        return new DOMRect(c.left, c.top, c.right - c.left, c.bottom - c.top);
      } catch {
        return new DOMRect(0, 0, 0, 0);
      }
    },
  };
}
