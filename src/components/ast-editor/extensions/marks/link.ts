import Link from "@tiptap/extension-link";

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
}).configure({
  openOnClick: false,
  autolink: false,
  protocols: ["http", "https", "mailto"],
});
