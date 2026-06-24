import { linkAttrs, navRefAttrs } from "./attrs";
import type { AstMarkType, MarkRenderer } from "./types";

export const MARK_MAP: Partial<Record<AstMarkType, MarkRenderer>> = {
  bold: () => ["strong", {}],
  italic: () => ["em", {}],
  code: () => ["code", { dir: "ltr" }],
  link: (mark) => ["a", linkAttrs(mark)],
  glossary_ref: (mark) => {
    const a = navRefAttrs(mark);
    return a ? ["a", a] : null;
  },
};
