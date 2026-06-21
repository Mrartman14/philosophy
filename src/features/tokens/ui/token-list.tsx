"use client";
// src/features/tokens/ui/token-list.tsx
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useToast,
} from "@/components/ui";
import { useT, useFmt } from "@/i18n/client";
import type { Formatters } from "@/i18n/format";
import { toastActionError } from "@/utils/action-toast";
import { relativeTimeParts, unixSecToDate } from "@/utils/dates";

import { revokeToken } from "../actions";
import { tokenStatus, type TokenStatus } from "../token-format";
import type { PatToken } from "../types";

const DATE_FMT: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Статус токена «сейчас». Date.now() инкапсулирован в функцию (вне тела
 *  рендера), как isExpired в share-links — иначе react-hooks/purity. */
function statusOf(token: PatToken): TokenStatus {
  return tokenStatus(token, Date.now());
}

/**
 * Относительный остаток до истечения («через N дней»). null для бессрочного и
 * уже истёкшего (статус и так это показывает). Акцент при < 7 дней. Date.now()
 * и fmt — внутри plain-функции (не компонент/хук), как statusOf.
 */
function expiryNote(sec: number | undefined, fmt: Formatters): ReactNode {
  const d = unixSecToDate(sec);
  if (!d) return null;
  const ms = d.getTime();
  const now = Date.now();
  if (ms <= now) return null;
  const { value, unit } = relativeTimeParts(ms, now);
  const cls =
    ms - now < SEVEN_DAYS_MS
      ? "block text-xs text-(--color-warning-fg)"
      : "block text-xs text-(--color-fg-muted)";
  return <span className={cls}>{fmt.relativeTime(value, unit, { numeric: "auto" })}</span>;
}

interface Props {
  tokens: PatToken[];
  canManage: boolean;
}

export function TokenList({ tokens, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("tokens");
  const tErrors = useT("errors");
  const fmt = useFmt();
  const [pending, startTransition] = useTransition();

  const statusLabel: Record<TokenStatus, string> = {
    active: t("statusActive"),
    revoked: t("statusRevoked"),
    expired: t("statusExpired"),
  };

  function fmtDate(sec?: number): string {
    const d = unixSecToDate(sec);
    return d ? fmt.dateTime(d, DATE_FMT) : "—";
  }

  function fmtExpires(sec?: number): string {
    const d = unixSecToDate(sec);
    return d ? fmt.dateTime(d, DATE_FMT) : t("neverExpires");
  }

  function onRevoke(id: string) {
    startTransition(async () => {
      const result = await revokeToken({ id });
      if (result.success) {
        toast.add({ title: t("revokedToast") });
        router.refresh();
      } else {
        toastActionError(toast, tErrors, result, {
          action: t("revokeAction"),
          forbiddenTitle: tErrors("failureTitle"),
        });
      }
    });
  }

  if (tokens.length === 0) {
    return <EmptyState title={t("emptyTitle")} description={t("emptyDesc")} />;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>{t("colStatus")}</Th>
          <Th>{t("colLabel")}</Th>
          <Th>{t("colHint")}</Th>
          <Th>{t("colCreated")}</Th>
          <Th>{t("colExpires")}</Th>
          <Th>{t("colLastUsed")}</Th>
          <Th>{t("colRequests")}</Th>
          {canManage && <Th>{t("colAction")}</Th>}
        </Tr>
      </Thead>
      <Tbody>
        {tokens.map((token) => {
          const id = token.id ?? "";
          const status = statusOf(token);
          const hint = token.token_hint?.trim();
          const label = token.label?.trim();
          return (
            <Tr key={id}>
              <Td>{statusLabel[status]}</Td>
              <Td>{label && label !== "" ? label : "—"}</Td>
              <Td>
                <code className="text-xs">{hint && hint !== "" ? hint : "—"}</code>
              </Td>
              <Td className="whitespace-nowrap">{fmtDate(token.created_at)}</Td>
              <Td className="whitespace-nowrap">
                {fmtExpires(token.expires_at)}
                {status === "active" && expiryNote(token.expires_at, fmt)}
              </Td>
              <Td className="whitespace-nowrap">{fmtDate(token.last_used_at)}</Td>
              <Td className="tabular-nums">{token.request_count ?? "—"}</Td>
              {canManage && (
                <Td>
                  {status === "active" && id ? (
                    <ConfirmDialog
                      destructive
                      trigger={
                        <Button type="button" variant="danger" disabled={pending}>
                          {t("revokeButton")}
                        </Button>
                      }
                      title={t("confirmRevokeTitle")}
                      description={t("confirmRevokeDesc")}
                      confirmLabel={t("revokeButton")}
                      onConfirm={() => { onRevoke(id); }}
                    />
                  ) : (
                    <span className="text-xs text-(--color-fg-muted)">—</span>
                  )}
                </Td>
              )}
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
