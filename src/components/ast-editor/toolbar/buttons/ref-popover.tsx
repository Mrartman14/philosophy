"use client";
import type { Editor } from "@tiptap/core";
import { useState } from "react";

import { BookmarkIcon } from "@/assets/icons/bookmark-icon";
import { Popover, Toolbar } from "@/components/ui";
import { useT } from "@/i18n/client";

import { RefMenu } from "../../pickers/ref-menu";
import type { SchemaSnapshot } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  defaultLectureId?: string | undefined;
}

export function RefPopover({ editor, schema, defaultLectureId }: Props) {
  const t = useT("editor");
  const [open, setOpen] = useState(false);

  // Show only if at least one nav-ref mark is registered.
  if (!schema.marks.has("lecture_ref")) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={<Toolbar.Button aria-label={t("insertRefAriaLabel")} />}
      >
        <BookmarkIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="p-3 min-w-[320px] max-w-[480px]">
            <Popover.Arrow />
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
