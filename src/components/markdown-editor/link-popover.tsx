"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Popover } from "@base-ui/react/popover";
import { LinkIcon } from "@/assets/icons/link-icon";

interface LinkPopoverProps {
  editor: Editor;
}

const btnBase =
  "p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg";
const btnActive = "bg-(--color-text-pane) text-(--color-primary)";

const inputClass =
  "border border-(--color-border) rounded px-2 py-1 text-sm bg-transparent outline-none focus:ring-1 focus:ring-(--color-primary) w-full";

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
    if (href.trim()) {
      editor.chain().focus().setLink({ href: href.trim() }).run();
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
        className={`${btnBase} ${isActive ? btnActive : ""}`}
        aria-label="Ссылка"
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
                  className="bg-(--color-primary) text-white rounded px-3 py-1 text-sm hover:opacity-90"
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
