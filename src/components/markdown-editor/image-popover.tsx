"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Popover } from "@base-ui/react/popover";
import { ImageIcon } from "@/assets/icons/image-icon";

interface ImagePopoverProps {
  editor: Editor;
}

const btnBase =
  "p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg";

const inputClass =
  "border border-(--color-border) rounded px-2 py-1 text-sm bg-transparent outline-none focus:ring-1 focus:ring-(--color-primary) w-full";

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
    if (src.trim()) {
      const opts: { src: string; alt?: string } = { src: src.trim() };
      if (alt.trim()) {
        opts.alt = alt.trim();
      }
      editor.chain().focus().setImage(opts).run();
    }
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
      <Popover.Trigger className={btnBase} aria-label="Изображение">
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
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                onKeyDown={handleKeyDown}
                className={inputClass}
                autoFocus
              />
              <input
                type="text"
                placeholder="Alt-текст (необязательно)"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                onKeyDown={handleKeyDown}
                className={inputClass}
              />
              <div className="flex items-center justify-end">
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
