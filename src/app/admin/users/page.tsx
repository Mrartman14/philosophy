import { UserStatusForm } from "@/features/admin/users/user-table";

export const metadata = { title: "Пользователи — Админ" };

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Пользователи</h1>
      <p className="text-sm text-(--color-description)">
        API не предоставляет список всех пользователей. Используйте форму ниже,
        чтобы изменить статус по ID.
      </p>
      <UserStatusForm />
    </div>
  );
}
