import { getLectures } from "@/features/lectures/api";

export const metadata = { title: "Админ-панель" };

export default async function AdminDashboardPage() {
  let lecturesTotal = 0;
  let loadError = false;
  try {
    const result = await getLectures(0, 1);
    lecturesTotal = result.total;
  } catch {
    loadError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Дашборд</h1>

      {loadError && (
        <p className="text-sm text-red-500" role="alert">
          Не удалось загрузить статистику.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Лекций" value={lecturesTotal} />
      </div>

      <p className="text-sm text-(--color-description)">
        Управление разделами — через меню слева.
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-(--color-border) rounded-lg p-4">
      <div className="text-xs uppercase text-(--color-description)">
        {label}
      </div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}
