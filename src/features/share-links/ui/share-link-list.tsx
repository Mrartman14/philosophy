"use client";
// src/features/share-links/ui/share-link-list.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  Button,
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
import { isPast } from "@/utils/dates";

import { revokeShareLink, adminRevokeShareLink } from "../actions";
import { buildShareUrl } from "../share-url";
import type { ShareLink, ResourceType } from "../types";

import { CopyButton } from "./copy-button";

const DATE_FMT_OPTS: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
};

interface Props {
  links: ShareLink[];
  resourceType: ResourceType;
  resourceId: string;
  /** true → admin-revoke (DELETE /api/admin/...); иначе owner-revoke. */
  admin?: boolean;
  /** Показывать ли копируемый URL (для своих ссылок — да; admin URL не нужен). */
  showUrl?: boolean;
}

export function ShareLinkList({
  links,
  resourceType,
  resourceId,
  admin = false,
  showUrl = true,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("shareLinks");
  const tErrors = useT("errors");
  const fmt = useFmt();
  const [pending, startTransition] = useTransition();

  function fmtDate(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : fmt.dateTime(d, DATE_FMT_OPTS);
  }

  function statusLabel(link: ShareLink): string {
    if (link.revoked_at) return t("statusRevoked");
    if (link.expires_at && isPast(link.expires_at)) {
      return t("statusExpired");
    }
    return t("statusActive");
  }

  function onRevoke(token: string) {
    startTransition(async () => {
      const action = admin ? adminRevokeShareLink : revokeShareLink;
      const result = await action({ token, resourceId });
      if (result.success) {
        toast.add({ title: t("revokedToast") });
        router.refresh();
      } else {
        toastActionError(toast, tErrors, result, {
          action: t("revokeLinkAction"),
          forbiddenTitle: tErrors("failureTitle"),
        });
      }
    });
  }

  if (links.length === 0) {
    return (
      <EmptyState
        title={t("emptyTitle")}
        description={t("emptyDesc")}
      />
    );
  }

  // canvas теперь имеет страницу /canvases/{id} (фаза 1), buildShareUrl его
  // поддерживает — URL строим для всех типов ресурсов.
  const canBuildUrl = showUrl;

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>{t("colStatus")}</Th>
          {canBuildUrl && <Th>{t("colLink")}</Th>}
          <Th>{t("colToken")}</Th>
          <Th>{t("colCreated")}</Th>
          <Th>{t("colExpires")}</Th>
          <Th>{t("colAction")}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {links.map((link) => {
          const token = link.token ?? "";
          const revoked = Boolean(link.revoked_at);
          const url =
            canBuildUrl && token
              ? buildShareUrl(resourceType, resourceId, token)
              : null;
          return (
            <Tr key={token}>
              <Td>{statusLabel(link)}</Td>
              {canBuildUrl && (
                <Td>
                  {url && !revoked ? (
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={url}
                        className="w-64 rounded border border-(--color-border) bg-(--color-surface-subtle) px-2 py-1 text-xs"
                        aria-label={t("urlAriaLabel")}
                      />
                      <CopyButton value={url} />
                    </div>
                  ) : (
                    "—"
                  )}
                </Td>
              )}
              <Td>
                <code className="text-xs" title={token}>
                  {token ? `${token.slice(0, 12)}…` : "—"}
                </code>
              </Td>
              <Td className="whitespace-nowrap">{fmtDate(link.created_at)}</Td>
              <Td className="whitespace-nowrap">{fmtDate(link.expires_at)}</Td>
              <Td>
                {revoked ? (
                  <span className="text-xs text-(--color-fg-muted)">—</span>
                ) : (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={pending || !token}
                    onClick={() => { onRevoke(token); }}
                  >
                    {t("revokeButton")}
                  </Button>
                )}
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
