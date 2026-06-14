// src/features/users/ui/users-table.tsx
import { EmptyState, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";

import type { AdminUser } from "../types";

import { UserRoleControl } from "./user-role-control";
import { UserStatusControl } from "./user-status-control";

const ROLE_LABELS: Record<string, string> = {
  user: "Пользователь",
  admin: "Администратор",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  suspended: "Приостановлен",
  banned: "Заблокирован",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

interface Props {
  users: AdminUser[];
  canModerate: boolean;
  /** id текущего пользователя: для своей строки контролы не показываем (бек вернёт 409). */
  meId: string;
}

export function UsersTable({ users, canModerate, meId }: Props) {
  if (users.length === 0) {
    return <EmptyState title="Пользователи не найдены" />;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Имя</Th>
          <Th>Роль</Th>
          <Th>Статус</Th>
          <Th>Создан</Th>
          <Th>ID</Th>
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
                  <span className="ml-1 text-xs text-(--color-description)">
                    (вы)
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
              <Td className="font-mono text-xs text-(--color-description)">
                {u.id}
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
