import type { User } from "@/api/types";
import { UserStatusInline } from "./user-status-inline";

interface UserTableProps {
  users: User[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function UserTable({ users }: UserTableProps) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">Пользователей нет.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-(--color-border)">
            <th className="py-2 pr-3">Username</th>
            <th className="py-2 pr-3">Роль</th>
            <th className="py-2 pr-3">Статус</th>
            <th className="py-2 pr-3">Создан</th>
            <th className="py-2 pr-3">ID</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-(--color-border)">
              <td className="py-2 pr-3 font-medium">{u.username}</td>
              <td className="py-2 pr-3">{u.role}</td>
              <td className="py-2 pr-3">
                <UserStatusInline userId={u.id} currentStatus={u.status} />
              </td>
              <td className="py-2 pr-3 text-(--color-description)">
                {formatDate(u.created_at)}
              </td>
              <td className="py-2 pr-3 text-xs text-(--color-description) font-mono">
                {u.id}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
