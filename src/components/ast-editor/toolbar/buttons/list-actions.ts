import type { Editor } from "@tiptap/core";

export type ListKind = "bullet" | "ordered" | "task";

export interface ListActive {
  bullet: boolean;
  ordered: boolean;
  task: boolean;
}

/**
 * Три ВЗАИМОИСКЛЮЧАЮЩИХ режима по позиции каретки. Чек-лист = ordered:false +
 * у пункта проставлен boolean checked, поэтому bullet и task различаются по
 * checked (иначе оба ordered:false подсвечивали бы кнопку буллета — был баг).
 */
export function listActiveState(editor: Editor): ListActive {
  const orderedActive = editor.isActive("list", { ordered: true });
  const unorderedActive = editor.isActive("list", { ordered: false });
  const checked = (editor.getAttributes("list_item") as { checked?: unknown }).checked;
  const isTask = editor.isActive("list_item") && typeof checked === "boolean";
  return {
    bullet: unorderedActive && !isTask,
    ordered: orderedActive,
    task: unorderedActive && isTask,
  };
}

/**
 * Перевести выделение в режим списка `kind`. Повторный клик по активному режиму —
 * выход из списка (toggle). Смена режима НЕ выходит из списка: правит ordered у
 * списка и checked у пункта (null для bullet/ordered, false для task).
 */
export function applyListKind(editor: Editor, kind: ListKind): void {
  if (listActiveState(editor)[kind]) {
    editor.chain().focus().lift("list_item").run();
    return;
  }

  const ordered = kind === "ordered";
  const chain = editor.chain().focus();

  if (!editor.isActive("list")) {
    chain.wrapIn("list", { ordered });
  } else if (!editor.isActive("list", { ordered })) {
    chain.updateAttributes("list", { ordered });
  }

  chain.updateAttributes("list_item", { checked: kind === "task" ? false : null });
  chain.run();
}
