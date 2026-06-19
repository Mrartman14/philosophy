"use client";
import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import type { Editor } from "@tiptap/core";
import { useRef, useState } from "react";

import { LinkIcon } from "@/assets/icons/link-icon";
import { useT } from "@/i18n/client";

import type { SchemaSnapshot } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
}

export function LinkPopover({ editor, schema }: Props) {
  const t = useT("editor");
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!schema.marks.has("link")) return null;

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      const currentHref =
        (editor.getAttributes("link").href as string | undefined) ?? "";
      setHref(currentHref);
      setErr(null);
    }
    setOpen(nextOpen);
  };

  const onApply = () => {
    const v = href.trim();
    if (!v) return;
    const empty = editor.state.selection.empty;
    if (empty) {
      // Collapsed selection — insert href as text with link-mark; otherwise
      // setMark only goes into storedMarks and the user sees nothing.
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: v,
          marks: [{ type: "link", attrs: { href: v } }],
        })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setMark("link", { href: v })
        .run();
    }
    // attr-plugin (Phase 1) rejects the mark when the URL scheme is not allowed.
    if (!editor.isActive("link", { href: v })) {
      setErr(t("linkInvalidScheme"));
      return;
    }
    setOpen(false);
    setHref("");
    setErr(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onApply();
    }
  };

  const isActive = editor.isActive("link");

  const handleRemove = () => {
    editor.chain().focus().unsetMark("link").run();
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpen}>
      <Popover.Trigger
        render={
          <Toolbar.Button
            aria-label={t("linkAriaLabel")}
            aria-pressed={isActive}
          />
        }
      >
        <LinkIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup
            initialFocus={inputRef}
            className="bg-(--color-surface) border border-(--color-border) rounded p-3 shadow-lg"
          >
            <Popover.Arrow className="fill-(--color-surface) stroke-(--color-border)" />
            <div className="flex flex-col gap-2 min-w-[260px]">
              <input
                ref={inputRef}
                type="url"
                value={href}
                onChange={(e) => { setHref(e.target.value); }}
                onKeyDown={handleKeyDown}
                placeholder="https://…"
                aria-label={t("linkUrlAriaLabel")}
                className="border border-(--color-border) rounded px-2 py-1 text-sm w-full"
              />
              {err ? (
                <p role="alert" className="text-red-500 text-xs">
                  {err}
                </p>
              ) : null}
              <div className="flex items-center gap-2 justify-end">
                {isActive && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="text-(--color-fg-muted) rounded px-3 py-1 text-sm hover:bg-(--color-surface-subtle)"
                  >
                    {t("linkRemove")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onApply}
                  disabled={!href.trim()}
                  className="bg-(--color-accent) text-white rounded px-3 py-1 text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("linkApply")}
                </button>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
