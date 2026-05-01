"use client";
import { Fragment } from "react";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@base-ui/react/toolbar";
import { InlineMarksGroup } from "./buttons/inline-marks";
import { HeadingSelect } from "./buttons/heading-select";
import { BlockButtonsGroup } from "./buttons/block-buttons";
import { ListButtonsGroup } from "./buttons/list-buttons";
import { LinkPopover } from "./buttons/link-popover";
import { RefPopover } from "./buttons/ref-popover";
import type { SchemaSnapshot, EntityContext } from "../types";

export interface EditorToolbarProps {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

export function EditorToolbar({ editor, schema, context }: EditorToolbarProps) {
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);

  // Visibility mirrors each group's internal gate. Duplicated intentionally
  // so toolbar can interleave separators only between non-empty groups.
  const groups = [
    {
      visible:
        schema.marks.has("bold") || schema.marks.has("italic") || schema.marks.has("code"),
      node: <InlineMarksGroup editor={editor} schema={schema} />,
    },
    {
      visible: allowed.has("heading"),
      node: <HeadingSelect editor={editor} schema={schema} context={context} />,
    },
    {
      visible:
        allowed.has("blockquote") ||
        allowed.has("code_block") ||
        allowed.has("thematic_break") ||
        allowed.has("table"),
      node: <BlockButtonsGroup editor={editor} schema={schema} context={context} />,
    },
    {
      visible: allowed.has("list"),
      node: <ListButtonsGroup editor={editor} schema={schema} context={context} />,
    },
    {
      visible: schema.marks.has("link"),
      node: <LinkPopover editor={editor} schema={schema} />,
    },
    {
      visible: schema.marks.has("lecture_ref"),
      node: <RefPopover editor={editor} schema={schema} />,
    },
  ].filter((g) => g.visible);

  return (
    <Toolbar.Root>
      {groups.map((g, i) => (
        <Fragment key={i}>
          {i > 0 && <Toolbar.Separator />}
          {g.node}
        </Fragment>
      ))}
    </Toolbar.Root>
  );
}
