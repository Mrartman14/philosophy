"use client";
import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import { LinkIcon } from "@/assets/icons/link-icon";
import type { SchemaSnapshot } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
}

export function LinkPopover({ editor, schema }: Props) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!schema.marks.has("link")) return null;

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      const currentHref =
        (editor.getAttributes("link").href as string) ?? "";
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
      setErr("Недопустимая схема ссылки (разрешены http, https, mailto)");
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
            aria-label="Ссылка"
            aria-pressed={isActive}
          />
        }
      >
        <LinkIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="bg-(--color-background) border border-(--color-border) rounded p-3 shadow-lg">
            <Popover.Arrow className="fill-(--color-background) stroke-(--color-border)" />
            <div className="flex flex-col gap-2 min-w-[260px]">
              <input
                type="url"
                value={href}
                onChange={(e) => setHref(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://…"
                aria-label="URL ссылки"
                autoFocus
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
                    className="text-(--color-description) rounded px-3 py-1 text-sm hover:bg-(--color-text-pane)"
                  >
                    Удалить ссылку
                  </button>
                )}
                <button
                  type="button"
                  onClick={onApply}
                  disabled={!href.trim()}
                  className="bg-(--color-primary) text-white rounded px-3 py-1 text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Применить
                </button>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
