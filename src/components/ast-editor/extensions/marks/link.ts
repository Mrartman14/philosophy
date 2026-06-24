import Link from "@tiptap/extension-link";

import { domSpecFromMark } from "../render-from-map";

/**
 * AST `link` mark: { href, title }. We deliberately do NOT inherit Tiptap's
 * default attrs (rel/target/class) because they leak into AST output and
 * the backend's `link` mark spec only declares href+title.
 */
export const LinkExt = Link.extend({
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (el) => el.getAttribute("href"),
        renderHTML: (attrs: { href?: string | null }) =>
          attrs.href ? { href: attrs.href } : {},
      },
      title: {
        default: null,
        parseHTML: (el) => el.getAttribute("title"),
        renderHTML: (attrs: { title?: string | null }) =>
          attrs.title ? { title: attrs.title } : {},
      },
    };
  },

  // mark→DOM делегируется единой карте: структурная база `<a href>`. Карта НЕ
  // несёт `title` (editor-only round-trip attr) — накладываем его СВЕРХУ, затем
  // добавляем content-hole (0). Фолбэк на `<a>`, если карты нет.
  renderHTML({ mark }) {
    const base = domSpecFromMark(mark.type.name, mark.attrs);
    const [tag, attrs] = base ?? ["a", {}];
    const title = mark.attrs.title as string | null | undefined;
    return [tag, title ? { ...attrs, title } : attrs, 0];
  },
}).configure({
  openOnClick: false,
  autolink: false,
  protocols: ["http", "https", "mailto"],
});
