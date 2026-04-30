import Link from "@tiptap/extension-link";

export const LinkExt = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: { default: null },
    };
  },
}).configure({
  openOnClick: false,
  autolink: false,
  protocols: ["http", "https", "mailto"],
});
