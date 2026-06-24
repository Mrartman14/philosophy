import Bold from "@tiptap/extension-bold";

import { domSpecFromMark } from "../render-from-map";

/**
 * AST `bold` mark → `<strong>`. Расширяем штатный `@tiptap/extension-bold`
 * (сохраняем keymaps Mod-b + input-rule `**bold**`), но mark→DOM делегируем
 * единой карте (`MARK_MAP`), а не StarterKit-дефолту — иначе editor и read
 * могли бы разойтись в структурной базе. Карта для bold всегда не-null →
 * `[tag, attrs, 0]` (content-hole добавляем мы). Null невозможен (bold —
 * безусловная запись MARK_MAP); бросаем при дрейфе, а не маскируем рассинхрон
 * single-source-of-truth фолбэком.
 */
export const BoldExt = Bold.extend({
  renderHTML({ mark }) {
    const base = domSpecFromMark(mark.type.name, mark.attrs);
    if (base === null) throw new Error(`[ast] no MARK_MAP entry for "${mark.type.name}"`);
    return [...base, 0];
  },
});
