// src/app/me/tokens/page.tsx
import type { Metadata } from "next";

import { API_URL } from "@/api/client";
import { canManageTokens, getTokens, getUsageTracking, TokensManager } from "@/features/tokens";
import { getT } from "@/i18n";
import { trimApiBase } from "@/utils/export-urls";
import { requireUserOrRedirect } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("pages");
  return { title: t("tokensTitle") };
}

export default async function TokensPage() {
  const me = await requireUserOrRedirect("/me/tokens");
  const t = await getT("pages");
  const [tokens, usageTracking] = await Promise.all([getTokens(), getUsageTracking()]);
  // MCP-эндпоинт живёт в корне бека (не под /api): <origin>/mcp.
  const mcpUrl = `${trimApiBase(API_URL)}/mcp`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t("tokensHeading")}</h1>
        <p className="text-sm text-(--color-fg-muted)">{t("tokensSubtitle")}</p>
      </header>

      <TokensManager
        initialTokens={tokens}
        canManage={canManageTokens(me)}
        mcpUrl={mcpUrl}
        trackingEnabled={usageTracking.tracking_enabled ?? false}
      />
    </div>
  );
}
