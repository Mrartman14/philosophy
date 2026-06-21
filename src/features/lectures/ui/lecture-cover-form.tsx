"use client";
import { useState, useTransition } from "react";

import { uploadImage } from "@/components/ast-editor/upload/upload-image";
import { Button, Label, TextInput } from "@/components/ui";
import { useT } from "@/i18n/client";

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
  const tL = useT("lectures");
  const tErrors = useT("errors");
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
            ? tErrors("forbiddenAction", { action: tL("coverForbiddenAction") })
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
            ? tErrors("forbiddenAction", { action: tL("coverForbiddenAction") })
            : res.error,
        );
        return;
      }
      setCurrentKey(null);
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-label={tL("coverSectionLabel")}>
      <h2 className="text-lg font-semibold">{tL("coverHeading")}</h2>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={alt || tL("coverAlt")}
          className="max-h-48 w-auto rounded border border-(--color-border) object-cover"
        />
      ) : (
        <p className="text-sm text-(--color-fg-muted)">{tL("coverEmpty")}</p>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="cover-alt">{tL("coverAltLabel")}</Label>
        <TextInput
          id="cover-alt"
          value={alt}
          maxLength={500}
          onChange={(e) => { setAlt(e.target.value); }}
        />
      </div>

      <div className="flex items-center gap-2">
        <Label>
          <span className="cursor-pointer rounded border border-(--color-border) px-3 py-1.5 hover:bg-(--color-surface-subtle)">
            {currentKey ? tL("replaceCover") : tL("uploadCover")}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={pending}
            onChange={onFile}
          />
        </Label>
        {currentKey && (
          <Button tone="danger" disabled={pending} onClick={onClear}>
            {tL("deleteCover")}
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
