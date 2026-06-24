import Italic from "@tiptap/extension-italic";

import { domSpecFromMark } from "../render-from-map";

/**
 * AST `italic` mark → `<em>`. Расширяем штатный `@tiptap/extension-italic`
 * (сохраняем keymaps Mod-i + input-rule `*italic*`), но mark→DOM делегируем
 * единой карте (`MARK_MAP`), а не StarterKit-дефолту. Карта для italic всегда
 * не-null → `[tag, attrs, 0]` (content-hole добавляем мы). Null невозможен
 * (italic — безусловная запись MARK_MAP); бросаем при дрейфе, а не маскируем
 * рассинхрон фолбэком.
 */
export const ItalicExt = Italic.extend({
  renderHTML({ mark }) {
    const base = domSpecFromMark(mark.type.name, mark.attrs);
    if (base === null) throw new Error(`[ast] no MARK_MAP entry for "${mark.type.name}"`);
    return [...base, 0];
  },
});
