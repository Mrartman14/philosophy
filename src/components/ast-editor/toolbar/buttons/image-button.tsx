// src/components/ast-editor/toolbar/buttons/image-button.tsx
"use client";
import { useRef, useState, type ChangeEvent } from "react";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@base-ui/react/toolbar";
import { ImageIcon } from "@/assets/icons/image-icon";
import { useToast } from "@/components/ui";
import { uploadImage } from "../../upload/upload-image";
import type { SchemaSnapshot, EntityContext } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

/**
 * Toolbar-кнопка вставки изображения: скрытый file-input → uploadImage
 * (server action из Phase 2a) → insertContent image-блока. Ошибки — toast
 * (провайдер смонтирован в root layout). Гейтится per-context, как остальные
 * block-кнопки (самогейт + дублирующий гейт в toolbar.tsx для сепараторов).
 */
export function ImageButton({ editor, schema, context }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  if (!allowed.has("image")) return null;

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Сбрасываем value, чтобы повторный выбор того же файла снова дал change.
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadImage(fd);
      if (!res.success) {
        toast.add({
          title: "Не удалось загрузить изображение",
          description:
            res.code === "forbidden"
              ? "У вас нет прав на загрузку изображений."
              : res.error,
        });
        return;
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: {
            storage_key: res.data.storage_key,
            alt: "",
            caption: "",
            blockId: "",
          },
        })
        .run();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Toolbar.Button
        aria-label="Изображение"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <ImageIcon />
      </Toolbar.Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        onChange={(e) => {
          void handleFile(e);
        }}
      />
    </>
  );
}
