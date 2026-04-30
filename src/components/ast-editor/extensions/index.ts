import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import type { Extensions } from "@tiptap/core";
import type { EntityContext, SchemaSnapshot } from "../types";
import { createLimitsPlugin } from "../validation/limits-plugin";
import { createAttrPlugin } from "../validation/attr-plugin";
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

  // StarterKit: keep paragraph, text, hard_break, history, dropcursor, gapcursor.
  // Disable nodes we replace with custom: heading, codeBlock, bulletList, orderedList, listItem.
  // Keep blockquote, horizontalRule, bold, italic, code from StarterKit defaults.
  const starter = StarterKit.configure({
    heading: false,
    codeBlock: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
  });

  const exts: Extensions = [starter, Placeholder.configure({ placeholder: placeholder ?? "" })];

  if (allowedBlocks.has("heading")) exts.push(HeadingExt);
  if (allowedBlocks.has("code_block")) exts.push(CodeBlockExt);
  if (allowedBlocks.has("list")) exts.push(ListExt, ListItemExt);
  if (allowedBlocks.has("image")) exts.push(ImageExt);
  if (allowedBlocks.has("table")) exts.push(TableExt, TableRowExt, TableCellExt);
  // thematic_break is StarterKit's HorizontalRule — kept above.

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
