import { Mark, mergeAttributes } from "@tiptap/core";

const NAV_MARK_TYPES = [
  "glossary_ref",
  "document_ref",
  "comment_ref",
  "media_ref",
  "canvas_ref",
] as const;

export type NavMarkType = (typeof NAV_MARK_TYPES)[number];

/**
 * Factory creating a Tiptap Mark for one of the 6 navigation-ref types.
 * Stores all attrs as data-attr-<name> on a span for round-trip safety.
 * Specific picker UX is wired in Phase 2.
 */
export function createNavRefMark(type: NavMarkType) {
  return Mark.create({
    name: type,
    inclusive: false,
    excludes: NAV_MARK_TYPES.filter((t) => t !== type).join(" "),

    addAttributes() {
      return {
        id: { default: "" },
        start_block_id: { default: null },
        start_char: { default: null },
        end_block_id: { default: null },
        end_char: { default: null },
        block_ids: { default: null },
        exact: { default: null },
        prefix: { default: null },
        suffix: { default: null },
        start: { default: null },
        end: { default: null },
      };
    },

    parseHTML() {
      return [{ tag: `span[data-mark="${type}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        "span",
        mergeAttributes(HTMLAttributes, { "data-mark": type, class: `nav-ref nav-ref--${type}` }),
        0,
      ];
    },
  });
}

export const navRefMarks = NAV_MARK_TYPES.map((t) => createNavRefMark(t));
