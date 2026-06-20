"use client";
// src/features/tokens/ui/copy-button.tsx
import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";

interface Props {
  value: string;
  label?: string;
}

/**
 * Кнопка «копировать» с фолбэком: navigator.clipboard недоступен в insecure-
 * контексте / старом браузере — тогда toast с просьбой скопировать вручную.
 */
export function CopyButton({ value, label }: Props) {
  const t = useT("tokens");
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- clipboard типизирован как всегда присутствующий, но undefined в insecure-контексте
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.add({ title: t("copiedToast") });
      setTimeout(() => { setCopied(false); }, 2000);
    } catch {
      toast.add({ title: t("copyFailTitle"), description: t("copyFailDesc") });
    }
  }

  return (
    <Button type="button" variant="ghost" onClick={() => { void onCopy(); }}>
      {copied ? t("copiedLabel") : (label ?? t("copyLabel"))}
    </Button>
  );
}
