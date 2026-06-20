"use client";
// src/features/tokens/ui/token-list.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
import { toastActionError } from "@/utils/action-toast";

import { revokeToken } from "../actions";
import { tokenStatus, unixSecToDate, type TokenStatus } from "../token-format";
import type { PatToken } from "../types";

const DATE_FMT: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
};

/** Статус токена «сейчас». Date.now() инкапсулирован в функцию (вне тела
 *  рендера), как isExpired в share-links — иначе react-hooks/purity. */
function statusOf(token: PatToken): TokenStatus {
  return tokenStatus(token, Date.now() / 1000);
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

  function fmtCreated(sec?: number): string {
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
              <Td className="whitespace-nowrap">{fmtCreated(token.created_at)}</Td>
              <Td className="whitespace-nowrap">{fmtExpires(token.expires_at)}</Td>
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
