"use client";
// src/features/share-links/ui/copy-button.tsx
import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";

interface Props {
  value: string;
  label?: string;
}

/**
 * Кнопка «копировать» с фолбэком: navigator.clipboard может быть недоступен
 * (http без localhost, старый браузер) — тогда показываем toast с просьбой
 * скопировать вручную, не роняя UI.
 */
export function CopyButton({ value, label }: Props) {
  const t = useT("shareLinks");
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- navigator.clipboard типизирован как всегда присутствующий, но undefined в insecure-контексте/старых браузерах
      if (!navigator.clipboard) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.add({ title: t("copiedToast") });
      setTimeout(() => { setCopied(false); }, 2000);
    } catch {
      toast.add({
        title: t("copyFailTitle"),
        description: t("copyFailDesc"),
      });
    }
  }

  return (
    <Button type="button" tone="quiet" onClick={() => { void onCopy(); }}>
      {copied ? t("copiedLabel") : (label ?? t("copyDefault"))}
    </Button>
  );
}
