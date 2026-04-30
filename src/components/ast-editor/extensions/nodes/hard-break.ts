import HardBreak from "@tiptap/extension-hard-break";

/**
 * Tiptap default node-name for HardBreak is "hardBreak" — rename to AST
 * canonical "hard_break" so PM type round-trips into AST without aliasing.
 */
export const HardBreakExt = HardBreak.extend({
  name: "hard_break",
});
