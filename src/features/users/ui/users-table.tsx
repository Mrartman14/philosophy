// src/features/users/ui/users-table.tsx
import { EmptyState, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";
import { getServerFmt, getT } from "@/i18n";

import type { AdminUser } from "../types";

import { UserRoleControl } from "./user-role-control";
import { UserStatusControl } from "./user-status-control";

interface Props {
  users: AdminUser[];
  canModerate: boolean;
  /** id текущего пользователя: для своей строки контролы не показываем (бек вернёт 409). */
  meId: string;
}

export async function UsersTable({ users, canModerate, meId }: Props) {
  const t = await getT("users");
  const fmt = await getServerFmt();

  const ROLE_LABELS: Record<string, string> = {
    user: t("roleUser"),
    admin: t("roleAdmin"),
  };

  const STATUS_LABELS: Record<string, string> = {
    active: t("statusActive"),
    suspended: t("statusSuspended"),
    banned: t("statusBanned"),
  };

  function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return t("dateFallback");
    return fmt.dateTime(d, { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  if (users.length === 0) {
    return <EmptyState title={t("emptyState")} />;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>{t("colName")}</Th>
          <Th>{t("colRole")}</Th>
          <Th>{t("colStatus")}</Th>
          <Th>{t("colCreated")}</Th>
          <Th>{t("colId")}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {users.map((u) => {
          const isSelf = u.id === meId;
          const editable = canModerate && !isSelf;
          return (
            <Tr key={u.id}>
              <Td>
                {u.username}
                {isSelf && (
                  <span className="ml-1 text-xs text-(--color-fg-muted)">
                    {t("selfBadge")}
                  </span>
                )}
              </Td>
              <Td>
                {editable ? (
                  <UserRoleControl
                    userId={u.id}
                    username={u.username}
                    current={u.role}
                  />
                ) : (
                  (ROLE_LABELS[u.role] ?? u.role)
                )}
              </Td>
              <Td>
                {editable ? (
                  <UserStatusControl
                    userId={u.id}
                    username={u.username}
                    current={u.status}
                  />
                ) : (
                  (STATUS_LABELS[u.status] ?? u.status)
                )}
              </Td>
              <Td>{formatDate(u.created_at)}</Td>
              <Td className="font-mono text-xs text-(--color-fg-muted)">
                {u.id}
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
