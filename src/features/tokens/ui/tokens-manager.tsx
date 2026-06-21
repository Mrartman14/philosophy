"use client";
// src/features/tokens/ui/tokens-manager.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  Button,
  Form,
  FormField,
  IdempotencyField,
  Label,
  Select,
  TextInput,
  useToast,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";
import type { ActionResult } from "@/utils/create-action";

import { createToken } from "../actions";
import type { CreatedToken, PatToken } from "../types";

import { ConnectInstructions } from "./connect-instructions";
import { CopyButton } from "./copy-button";
import { TokenList } from "./token-list";
import { UsageTrackingToggle } from "./usage-tracking-toggle";

const initialState: ActionResult<CreatedToken | null> = {
  success: true,
  data: null,
};

interface Props {
  initialTokens: PatToken[];
  canManage: boolean;
  /** Абсолютный URL MCP-эндпоинта для блока «как подключить». */
  mcpUrl: string;
  /** pat.UsageTracking.tracking_enabled со страницы. */
  trackingEnabled: boolean;
}

/**
 * Управление персональными токенами: форма создания + одноразовый показ
 * сырого секрета + таблица существующих токенов. Создание — server action
 * createToken; после успеха router.refresh() обновляет список (reveal-блок
 * переживает refresh, т.к. живёт в client-state).
 */
export function TokensManager({ initialTokens, canManage, mcpUrl, trackingEnabled }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("tokens");
  const tErrors = useT("errors");
  const [state, formAction, pending] = useActionState(createToken, initialState);
  const [revealed, setRevealed] = useState<string | null>(null);

  const expiryOptions = [
    { value: "", label: t("expiresNever") },
    { value: "7", label: t("expires7") },
    { value: "30", label: t("expires30") },
    { value: "90", label: t("expires90") },
  ];

  useEffect(() => {
    if (state.success && state.data) {
      const raw = state.data.token;
      if (raw !== "") {
        setRevealed(raw);
      } else {
        toast.add({
          title: t("createdNoSecretTitle"),
          description: t("createdNoSecretDesc"),
        });
      }
      router.refresh();
    } else if (!state.success) {
      toastActionError(toast, tErrors, state, {
        action: t("createAction"),
        forbiddenTitle: tErrors("failureTitle"),
      });
    }
    // state — единственный триггер; toast/router/t стабильны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <Form
          action={formAction}
          className="flex flex-col gap-3 rounded-lg border border-(--color-border) bg-(--color-surface) p-4"
        >
          <IdempotencyField result={state} />
          <div className="flex flex-wrap items-end gap-3">
            <FormField name="label" label={t("labelField")} required className="flex-1">
              <TextInput
                name="label"
                required
                maxLength={100}
                placeholder={t("labelPlaceholder")}
              />
            </FormField>
            <Label className="flex flex-col gap-1">
              <span className="text-xs text-(--color-fg-muted)">
                {t("expiresField")}
              </span>
              <Select
                name="expires_in_days"
                defaultValue=""
                options={expiryOptions}
                aria-label={t("expiresField")}
                className="w-40"
              />
            </Label>
            <Button type="submit" disabled={pending}>
              {pending ? "…" : t("createButton")}
            </Button>
          </div>
          <p className="text-xs text-(--color-fg-muted)">{t("createHint")}</p>
          <p className="text-xs text-(--color-fg-muted)">{t("limitsHint")}</p>
        </Form>
      )}

      {revealed !== null && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-lg border border-(--color-accent) bg-(--color-surface-subtle) p-4"
        >
          <p className="text-sm font-semibold">{t("revealTitle")}</p>
          <p className="text-xs text-(--color-fg-muted)">{t("revealWarning")}</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={revealed}
              aria-label={t("revealAriaLabel")}
              className="flex-1 rounded border border-(--color-border) bg-(--color-surface) px-2 py-1 font-mono text-xs"
            />
            <CopyButton value={revealed} />
            <Button
              type="button"
              tone="quiet"
              onClick={() => { setRevealed(null); }}
            >
              {t("revealDismiss")}
            </Button>
          </div>
        </div>
      )}

      <ConnectInstructions mcpUrl={mcpUrl} token={revealed} />

      {canManage && (
        <UsageTrackingToggle initialEnabled={trackingEnabled} />
      )}

      <TokenList tokens={initialTokens} canManage={canManage} />
    </div>
  );
}
