import Strike from "@tiptap/extension-strike";

import { domSpecFromMark } from "../render-from-map";

/**
 * AST `strike` mark → `<s>`. Расширяем штатный `@tiptap/extension-strike`
 * (сохраняем keymap Mod-Shift-s + input-rule `~~strike~~`), но mark→DOM
 * делегируем единой карте (`MARK_MAP`), а не StarterKit-дефолту — иначе editor
 * и read могли бы разойтись в структурной базе. Карта для strike всегда
 * не-null → `[tag, attrs, 0]` (content-hole добавляем мы). Null невозможен
 * (strike — безусловная запись MARK_MAP); бросаем при дрейфе, а не маскируем
 * рассинхрон single-source-of-truth фолбэком.
 */
export const StrikeExt = Strike.extend({
  renderHTML({ mark }) {
    const base = domSpecFromMark(mark.type.name, mark.attrs);
    if (base === null) throw new Error(`[ast] no MARK_MAP entry for "${mark.type.name}"`);
    return [...base, 0];
  },
});
