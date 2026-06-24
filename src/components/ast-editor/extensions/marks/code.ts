import Code from "@tiptap/extension-code";

import { domSpecFromMark } from "../render-from-map";

/**
 * AST `code` mark → `<code dir="ltr">`. Расширяем штатный
 * `@tiptap/extension-code` (сохраняем keymaps Mod-e + input-rule `` `code` ``),
 * но mark→DOM делегируем единой карте (`MARK_MAP`), а не StarterKit-дефолту:
 * только так editor получает bidi-изоляцию `dir="ltr"` (паритет с read, см.
 * ast-render-bidi.test.tsx) — дефолт эмитил голый `<code>`. Карта для code
 * всегда не-null → `[tag, attrs, 0]` (content-hole добавляем мы). Null
 * невозможен (code — безусловная запись MARK_MAP); бросаем при дрейфе, а не
 * маскируем рассинхрон фолбэком.
 */
export const CodeExt = Code.extend({
  renderHTML({ mark }) {
    const base = domSpecFromMark(mark.type.name, mark.attrs);
    if (base === null) throw new Error(`[ast] no MARK_MAP entry for "${mark.type.name}"`);
    return [...base, 0];
  },
});
