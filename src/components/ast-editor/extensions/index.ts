import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import type { Extensions } from "@tiptap/core";
import type { EntityContext, SchemaSnapshot } from "../types";
import { createLimitsPlugin } from "../validation/limits-plugin";
import { createAttrPlugin } from "../validation/attr-plugin";
import { ParagraphExt } from "./nodes/paragraph";
import { BlockquoteExt } from "./nodes/blockquote";
import { ThematicBreakExt } from "./nodes/thematic-break";
import { HeadingExt } from "./nodes/heading";
import { CodeBlockExt } from "./nodes/code-block";
import { ListExt, ListItemExt } from "./nodes/list";
import { ImageExt } from "./nodes/image";
import { TableExt, TableRowExt, TableCellExt } from "./nodes/table";
import { LinkExt } from "./marks/link";
import { navRefMarks } from "./marks/nav-ref";

interface BuildOpts {
  snapshot: SchemaSnapshot;
  context: EntityContext;
  placeholder?: string | undefined;
}

export function buildExtensions({ snapshot, context, placeholder }: BuildOpts): Extensions {
  const level = snapshot.entityContexts[context] ?? "";
  const allowedBlocks = new Set(snapshot.blockLevels[level] ?? []);

  // StarterKit: we replace every block-level node with a custom version that
  // carries blockId attr — PM-schema must declare blockId or it gets dropped
  // on parse, breaking AST round-trip. Keep StarterKit only for: text,
  // hard_break, history, dropcursor, gapcursor, bold/italic/code marks.
  const starter = StarterKit.configure({
    paragraph: false,
    blockquote: false,
    heading: false,
    codeBlock: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    horizontalRule: false,
  });

  // ParagraphExt is always required (it's the default block + appears inside
  // blockquote/list_item/table_cell content models). Even contexts that
  // declare a strict block_levels list rely on paragraph for inline text.
  const exts: Extensions = [starter, ParagraphExt, Placeholder.configure({ placeholder: placeholder ?? "" })];

  if (allowedBlocks.has("heading")) exts.push(HeadingExt);
  if (allowedBlocks.has("blockquote")) exts.push(BlockquoteExt);
  if (allowedBlocks.has("code_block")) exts.push(CodeBlockExt);
  if (allowedBlocks.has("list")) exts.push(ListExt, ListItemExt);
  if (allowedBlocks.has("image")) exts.push(ImageExt);
  if (allowedBlocks.has("table")) exts.push(TableExt, TableRowExt, TableCellExt);
  if (allowedBlocks.has("thematic_break")) exts.push(ThematicBreakExt);

  // Marks are universally available (per-context filtering for marks lives in toolbar gating, Phase 2).
  exts.push(LinkExt, ...navRefMarks);

  const validation = Extension.create({
    name: "ast-validation",
    addProseMirrorPlugins() {
      return [createLimitsPlugin(snapshot, level), createAttrPlugin(snapshot)];
    },
  });
  exts.push(validation);

  return exts;
}
