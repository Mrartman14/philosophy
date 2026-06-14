"use client";
import { Toolbar } from "@base-ui/react/toolbar";
import type { Editor } from "@tiptap/core";
import { Fragment } from "react";

import type { SchemaSnapshot, EntityContext } from "../types";

import { BlockButtonsGroup } from "./buttons/block-buttons";
import { HeadingSelect } from "./buttons/heading-select";
import { ImageButton } from "./buttons/image-button";
import { InlineMarksGroup } from "./buttons/inline-marks";
import { LinkPopover } from "./buttons/link-popover";
import { ListButtonsGroup } from "./buttons/list-buttons";
import { RefPopover } from "./buttons/ref-popover";


export interface EditorToolbarProps {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
  /** Контекст лекции для comment_ref picker'а (2-stage стартует сразу с шага 2). */
  defaultLectureId?: string | undefined;
}

export function EditorToolbar({ editor, schema, context, defaultLectureId }: EditorToolbarProps) {
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
      visible: allowed.has("image"),
      node: <ImageButton editor={editor} schema={schema} context={context} />,
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
      node: <RefPopover editor={editor} schema={schema} defaultLectureId={defaultLectureId} />,
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
