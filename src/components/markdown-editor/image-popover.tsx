"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import { ImageIcon } from "@/assets/icons/image-icon";
import { btnBase, inputClass } from "./styles";

interface ImagePopoverProps {
  editor: Editor;
}

export const ImagePopover: React.FC<ImagePopoverProps> = ({ editor }) => {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setSrc("");
      setAlt("");
    }
    setOpen(nextOpen);
  };

  const handleInsert = () => {
    const url = src.trim();
    if (!url) return;

    const opts: { src: string; alt?: string } = { src: url };
    if (alt.trim()) {
      opts.alt = alt.trim();
    }
    editor.chain().focus().setImage(opts).run();
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
            aria-label="Изображение"
            className={btnBase}
          />
        }
      >
        <ImageIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="bg-(--color-background) border border-(--color-border) rounded p-3 shadow-lg">
            <Popover.Arrow className="fill-(--color-background) stroke-(--color-border)" />
            <div className="flex flex-col gap-2 min-w-[260px]">
              <input
                type="url"
                placeholder="https://example.com/image.png"
                aria-label="URL изображения"
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                onKeyDown={handleKeyDown}
                className={inputClass}
                autoFocus
              />
              <input
                type="text"
                placeholder="Alt-текст (необязательно)"
                aria-label="Alt-текст"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                onKeyDown={handleKeyDown}
                className={inputClass}
              />
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleInsert}
                  disabled={!src.trim()}
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
