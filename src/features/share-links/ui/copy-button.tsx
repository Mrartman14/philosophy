"use client";
// src/features/share-links/ui/copy-button.tsx
import { useState } from "react";
import { Button, useToast } from "@/components/ui";

interface Props {
  value: string;
  label?: string;
}

/**
 * Кнопка «копировать» с фолбэком: navigator.clipboard может быть недоступен
 * (http без localhost, старый браузер) — тогда показываем toast с просьбой
 * скопировать вручную, не роняя UI.
 */
export function CopyButton({ value, label = "Копировать" }: Props) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      if (!navigator.clipboard) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.add({ title: "Скопировано" });
      setTimeout(() => { setCopied(false); }, 2000);
    } catch {
      toast.add({
        title: "Не удалось скопировать",
        description: "Выделите ссылку и скопируйте вручную.",
      });
    }
  }

  return (
    <Button type="button" variant="ghost" onClick={onCopy}>
      {copied ? "Скопировано ✓" : label}
    </Button>
  );
}
