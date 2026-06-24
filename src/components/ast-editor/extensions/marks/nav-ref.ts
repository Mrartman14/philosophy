import { Mark, mergeAttributes } from "@tiptap/core";

import { domSpecFromMark } from "../render-from-map";

const NAV_MARK_TYPES = [
  "glossary_ref",
  "document_ref",
  "comment_ref",
  "media_ref",
  "canvas_ref",
] as const;

export type NavMarkType = (typeof NAV_MARK_TYPES)[number];

/**
 * Factory creating a Tiptap Mark for one of the {@link NAV_MARK_TYPES}
 * navigation-ref types.
 *
 * Round-trip attrs (id, anchor fields, …) are emitted as BARE HTML attributes
 * via Tiptap's default attribute rendering in HTMLAttributes (no `data-attr-`
 * prefix). The structural shape — tag, `href`, `class`, `data-mark` — comes
 * from the neutral render map: renderHTML normally emits an `<a>`, falling back
 * to a `<span>` only when the id is empty (map returns null). Specific picker
 * UX is wired in Phase 2.
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

    // mark→DOM делегируется единой карте: структурная база `<a href data-mark
    // class>` (зафиксированная унификация span→a, edit И read). Карта НЕ несёт
    // ~11 anchor round-trip attrs (id, start_block_id, start_char, …) —
    // редактор кладёт их через дефолтный рендер attrs в HTMLAttributes;
    // накладываем структурную базу СВЕРХУ, чтобы href/class/data-mark
    // унифицировались, а round-trip attrs выжили. Фолбэк (пустой id → карта
    // вернула null): прежнее поведение — `<span>` с round-trip attrs.
    renderHTML({ mark, HTMLAttributes }) {
      const base = domSpecFromMark(mark.type.name, mark.attrs);
      if (base === null) {
        return [
          "span",
          mergeAttributes(HTMLAttributes, { "data-mark": type, class: `nav-ref nav-ref--${type}` }),
          0,
        ];
      }
      return ["a", { ...HTMLAttributes, ...base[1] }, 0];
    },
  });
}

export const navRefMarks = NAV_MARK_TYPES.map((t) => createNavRefMark(t));
