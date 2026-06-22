"use client";
// src/features/tokens/ui/connect-instructions.tsx
import { useT } from "@/i18n/client";

import { CopyButton } from "./copy-button";

interface Props {
  /** Абсолютный URL MCP-эндпоинта, напр. https://host/mcp. */
  mcpUrl: string;
  /** Сырой токен (есть только сразу после создания) — тогда сниппеты готовы к
   *  вставке; иначе подставляется плейсхолдер. */
  token: string | null;
}

const TOKEN_PLACEHOLDER = "phil_pat_…";

/**
 * Инструкция «как подключить» philosophy как MCP-коннектор к LLM-клиенту.
 * Read-only справка: URL + готовая команда для Claude Code + подсказка для
 * Desktop. Сразу после создания токена сниппет содержит реальный секрет.
 */
export function ConnectInstructions({ mcpUrl, token }: Props) {
  const t = useT("tokens");
  const tok = token ?? TOKEN_PLACEHOLDER;
  const cliCmd = `claude mcp add --transport http philosophy ${mcpUrl} --header "Authorization: Bearer ${tok}"`;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
      <h2 className="text-sm font-semibold">{t("connectTitle")}</h2>
      <p className="text-xs text-(--color-fg-muted)">{t("connectIntro")}</p>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-(--color-fg-muted)">{t("connectUrlLabel")}</span>
        <div className="flex items-center gap-2">
          <code dir="ltr" className="flex-1 overflow-x-auto rounded border border-(--color-border) bg-(--color-surface-subtle) px-2 py-1 text-xs">
            {mcpUrl}
          </code>
          <CopyButton value={mcpUrl} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-(--color-fg-muted)">{t("connectCliLabel")}</span>
        <div className="flex items-center gap-2">
          <code dir="ltr" className="flex-1 overflow-x-auto whitespace-pre rounded border border-(--color-border) bg-(--color-surface-subtle) px-2 py-1 text-xs">
            {cliCmd}
          </code>
          <CopyButton value={cliCmd} />
        </div>
      </div>

      <p className="text-xs text-(--color-fg-muted)">{t("connectDesktopHint")}</p>
    </section>
  );
}
