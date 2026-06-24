"use client";
import type { Editor } from "@tiptap/core";
import { useState } from "react";

import { AtIcon } from "@/assets/icons/at-icon";
import { Toolbar } from "@/components/ui";
import { useT } from "@/i18n/client";

import { RefPicker } from "../../pickers/ref-picker";
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
  if (!schema.marks.has("glossary_ref")) return null;

  return (
    <RefPicker
      editor={editor}
      defaultLectureId={defaultLectureId}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Toolbar.Button aria-label={t("insertRefAriaLabel")}>
          <AtIcon />
        </Toolbar.Button>
      }
    />
  );
}
