"use client";
// src/features/media/ui/media-upload-form.tsx
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";

import { uploadMedia } from "../upload-media";

interface MediaUploadFormProps {
  /** canCreateMedia(me) со страницы. Если false — форма не рендерится. */
  canUpload: boolean;
}

const ACCEPT = ".mp4,.webm,.mp3,.m4a,.ogg,video/*,audio/*";

/**
 * Форма загрузки медиа. type выбирается явно (бек требует точный video|audio).
 * Новое медиа создаётся приватным (бек: free-floating + private), поэтому
 * выбора видимости здесь нет — публикация делается на /media/[id].
 */
export function MediaUploadForm({ canUpload }: MediaUploadFormProps) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<"video" | "audio">("video");
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const t = useT("media");

  if (!canUpload) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.add({ title: t("uploadToastNoFile") });
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    fd.set("type", type);
    setBusy(true);
    const result = await uploadMedia(fd);
    setBusy(false);
    if (!result.success) {
      const description =
        result.code === "forbidden"
          ? t("uploadAction")
          : result.error;
      toast.add({ title: t("uploadErrorTitle"), description });
      return;
    }
    toast.add({ title: t("uploadSuccessTitle"), description: result.data.filename });
    if (inputRef.current) inputRef.current.value = "";
    startTransition(() => { router.refresh(); });
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="media-type" className="text-sm font-medium">
          {t("uploadTypeLabel")}
        </label>
        <select
          id="media-type"
          value={type}
          onChange={(e) => { setType(e.target.value as "video" | "audio"); }}
          className="rounded border border-(--color-border) bg-transparent px-3 py-2"
        >
          <option value="video">{t("uploadVideoOption")}</option>
          <option value="audio">{t("uploadAudioOption")}</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="media-file" className="text-sm font-medium">
          {t("uploadFileLabel")}
        </label>
        <input
          id="media-file"
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="text-sm"
        />
      </div>
      <Button type="submit" className="self-start" disabled={busy || pending}>
        {busy ? t("uploadBusy") : t("uploadSubmit")}
      </Button>
      <p className="text-xs text-(--color-fg-muted)">
        {t("uploadHint")}
      </p>
    </form>
  );
}
