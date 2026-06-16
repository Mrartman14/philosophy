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
import { toastActionError } from "@/utils/action-toast";

import { revokeShareLink, adminRevokeShareLink } from "../actions";
import { buildShareUrl } from "../share-url";
import type { ShareLink, ResourceType } from "../types";

import { CopyButton } from "./copy-button";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
});

function fmt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFormat.format(d);
}

function statusLabel(link: ShareLink): string {
  if (link.revoked_at) return "Отозвана";
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return "Истекла";
  }
  return "Активна";
}

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
  const [pending, startTransition] = useTransition();

  function onRevoke(token: string) {
    startTransition(async () => {
      const action = admin ? adminRevokeShareLink : revokeShareLink;
      const result = await action({ token, resourceId });
      if (result.success) {
        toast.add({ title: "Ссылка отозвана" });
        router.refresh();
      } else {
        toastActionError(toast, result, { action: "отзыв ссылки", forbiddenTitle: "Ошибка" });
      }
    });
  }

  if (links.length === 0) {
    return (
      <EmptyState
        title="Ссылок нет"
        description="Для этого ресурса ещё не выпущено ни одной ссылки."
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
          <Th>Статус</Th>
          {canBuildUrl && <Th>Ссылка</Th>}
          <Th>Токен</Th>
          <Th>Создана</Th>
          <Th>Истекает</Th>
          <Th>Действие</Th>
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
                        className="w-64 rounded border border-(--color-border) bg-(--color-text-pane) px-2 py-1 text-xs"
                        aria-label="URL ссылки"
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
              <Td className="whitespace-nowrap">{fmt(link.created_at)}</Td>
              <Td className="whitespace-nowrap">{fmt(link.expires_at)}</Td>
              <Td>
                {revoked ? (
                  <span className="text-xs text-(--color-description)">—</span>
                ) : (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={pending || !token}
                    onClick={() => { onRevoke(token); }}
                  >
                    Отозвать
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
