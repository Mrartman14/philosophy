// src/app/admin/page.tsx
export const metadata = { title: "Админ-панель" };

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Админ-панель</h1>
      <p className="text-sm text-(--color-fg-muted)">
        Управление разделами — через меню слева.
      </p>
    </div>
  );
}
