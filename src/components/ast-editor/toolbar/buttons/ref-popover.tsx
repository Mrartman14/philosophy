"use client";
import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import type { Editor } from "@tiptap/core";
import { useState } from "react";

import { BookmarkIcon } from "@/assets/icons/bookmark-icon";

import { RefMenu } from "../../pickers/ref-menu";
import type { SchemaSnapshot } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  defaultLectureId?: string | undefined;
}

export function RefPopover({ editor, schema, defaultLectureId }: Props) {
  const [open, setOpen] = useState(false);

  // Show only if at least one nav-ref mark is registered.
  if (!schema.marks.has("lecture_ref")) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={<Toolbar.Button aria-label="Вставить ссылку на сущность" />}
      >
        <BookmarkIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="bg-(--color-background) border border-(--color-border) rounded p-3 shadow-lg min-w-[320px] max-w-[480px]">
            <Popover.Arrow className="fill-(--color-background) stroke-(--color-border)" />
            <RefMenu
              editor={editor}
              defaultLectureId={defaultLectureId}
              onClose={() => { setOpen(false); }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
