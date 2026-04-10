"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import { LinkIcon } from "@/assets/icons/link-icon";
import { btnBase, btnActive, inputClass } from "./styles";

interface LinkPopoverProps {
  editor: Editor;
}

export const LinkPopover: React.FC<LinkPopoverProps> = ({ editor }) => {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");

  const isActive = editor.isActive("link");

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      const currentHref =
        (editor.getAttributes("link").href as string) ?? "";
      setHref(currentHref);
    }
    setOpen(nextOpen);
  };

  const handleInsert = () => {
    const url = href.trim();
    if (!url) return;

    if (editor.state.selection.empty && !isActive) {
      // No text selected — insert URL as linked text
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: url,
          marks: [{ type: "link", attrs: { href: url } }],
        })
        .run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    setOpen(false);
  };

  const handleRemove = () => {
    editor.chain().focus().unsetLink().run();
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInsert();
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpen}>
      <Popover.Trigger
        render={
          <Toolbar.Button
            aria-label="Ссылка"
            className={`${btnBase} ${isActive ? btnActive : ""}`}
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
                placeholder="https://example.com"
                aria-label="URL ссылки"
                value={href}
                onChange={(e) => setHref(e.target.value)}
                onKeyDown={handleKeyDown}
                className={inputClass}
                autoFocus
              />
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
                  onClick={handleInsert}
                  disabled={!href.trim()}
                  className="bg-(--color-primary) text-white rounded px-3 py-1 text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Вставить
                </button>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
