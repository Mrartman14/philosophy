"use client";
import { useState, useTransition } from "react";

import { uploadImage } from "@/components/ast-editor/upload/upload-image";
import { Button } from "@/components/ui";

import { setLectureCover, clearLectureCover } from "../actions";
import { lectureCoverUrl } from "../cover-url";

interface Props {
  lectureId: string;
  coverImageKey: string | null;
  coverImageAlt: string | null;
}

/**
 * Управление обложкой лекции (admin). Двухшаговый flow: (1) uploadImage
 * (POST /api/uploads/images) → upload_id; (2) setLectureCover (PUT cover).
 * Owner-only гейт — на странице (canManageCover); здесь только UI.
 */
export function LectureCoverForm({ lectureId, coverImageKey, coverImageAlt }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentKey, setCurrentKey] = useState<string | null>(coverImageKey);
  const [alt, setAlt] = useState(coverImageAlt ?? "");
  const previewUrl = lectureCoverUrl(currentKey);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const up = await uploadImage(fd);
      if (!up.success) {
        setError(up.error);
        return;
      }
      const res = await setLectureCover({
        id: lectureId,
        upload_id: up.data.upload_id,
        ...(alt ? { alt_text: alt } : {}),
      });
      if (!res.success) {
        setError(
          res.code === "forbidden"
            ? "У вас нет прав на изменение обложки."
            : res.error,
        );
        return;
      }
      setCurrentKey(up.data.storage_key);
    });
  }

  function onClear() {
    setError(null);
    startTransition(async () => {
      const res = await clearLectureCover(lectureId);
      if (!res.success) {
        setError(
          res.code === "forbidden"
            ? "У вас нет прав на изменение обложки."
            : res.error,
        );
        return;
      }
      setCurrentKey(null);
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Обложка лекции">
      <h2 className="text-lg font-semibold">Обложка</h2>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={alt || "Обложка лекции"}
          className="max-h-48 w-auto rounded border border-(--color-border) object-cover"
        />
      ) : (
        <p className="text-sm text-(--color-fg-muted)">Обложка не задана.</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Alt-текст (для доступности)
        <input
          type="text"
          value={alt}
          maxLength={500}
          onChange={(e) => { setAlt(e.target.value); }}
          className="rounded border border-(--color-border) px-2 py-1"
        />
      </label>

      <div className="flex items-center gap-2">
        <label className="cursor-pointer rounded border border-(--color-border) px-3 py-1.5 text-sm hover:bg-(--color-surface-subtle)">
          {currentKey ? "Заменить обложку" : "Загрузить обложку"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={pending}
            onChange={onFile}
          />
        </label>
        {currentKey && (
          <Button variant="danger" disabled={pending} onClick={onClear}>
            Удалить обложку
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
