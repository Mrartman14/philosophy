"use client";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@base-ui/react/toolbar";
import { InlineMarksGroup } from "./buttons/inline-marks";
import { HeadingSelect } from "./buttons/heading-select";
import { BlockButtonsGroup } from "./buttons/block-buttons";
import { ListButtonsGroup } from "./buttons/list-buttons";
import { LinkPopover } from "./buttons/link-popover";
import type { SchemaSnapshot, EntityContext } from "../types";

export interface EditorToolbarProps {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

export function EditorToolbar({ editor, schema, context }: EditorToolbarProps) {
  return (
    <Toolbar.Root>
      <InlineMarksGroup editor={editor} schema={schema} />
      <Toolbar.Separator />
      <HeadingSelect editor={editor} schema={schema} context={context} />
      <Toolbar.Separator />
      <BlockButtonsGroup editor={editor} schema={schema} context={context} />
      <Toolbar.Separator />
      <ListButtonsGroup editor={editor} schema={schema} context={context} />
      <Toolbar.Separator />
      <LinkPopover editor={editor} schema={schema} />
    </Toolbar.Root>
  );
}
