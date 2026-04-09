import { getLectures } from "@/features/lectures/api";

export const metadata = { title: "Админ-панель" };

// TODO (backend): для полного дашборда нужны list-эндпоинты со счётчиками:
//   - GET /api/admin/users       — сейчас отсутствует (см. docs/plans/2026-04-09-backend-bugs.md,
//     секция «Backend-gap (упоминается в P2-#21)»).
//   - GET /api/admin/comments    — нет глобального списка; публичный
//     /api/lectures/{id}/comments даёт total только в рамках одной лекции
//     и фильтруется по status='published' (P0-#15).
//   - GET /api/admin/annotations — симметрично комментариям.
//   - GET /api/admin/push/subscriptions — list-эндпоинта подписок вообще нет.
// После появления этих эндпоинтов заменить плейсхолдерные карточки на реальные
// вызовы в Promise.allSettled ниже.

interface MetricResult {
  value: number | null;
  error: boolean;
}

async function loadLecturesTotal(): Promise<MetricResult> {
  try {
    const result = await getLectures(0, 1);
    return { value: result.total, error: false };
  } catch {
    return { value: null, error: true };
  }
}

export default async function AdminDashboardPage() {
  const [lecturesResult] = await Promise.all([loadLecturesTotal()]);

  const hasError = lecturesResult.error;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Дашборд</h1>

      {hasError && (
        <p className="text-sm text-red-500" role="alert">
          Не удалось загрузить часть статистики.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Лекций"
          value={lecturesResult.value}
          error={lecturesResult.error}
        />
        <StatCard
          label="Пользователей"
          value={null}
          unavailable
          hint="Бэкенд не отдаёт"
        />
        <StatCard
          label="Комментариев"
          value={null}
          unavailable
          hint="Бэкенд не отдаёт"
        />
        <StatCard
          label="Аннотаций"
          value={null}
          unavailable
          hint="Бэкенд не отдаёт"
        />
        <StatCard
          label="Push-подписок"
          value={null}
          unavailable
          hint="Бэкенд не отдаёт"
        />
      </div>

      <p className="text-sm text-(--color-description)">
        Управление разделами — через меню слева.
      </p>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | null;
  error?: boolean;
  unavailable?: boolean;
  hint?: string;
}

function StatCard({
  label,
  value,
  error = false,
  unavailable = false,
  hint,
}: StatCardProps) {
  const display = error
    ? "—"
    : value === null
      ? "—"
      : value.toLocaleString("ru-RU");

  return (
    <div className="border border-(--color-border) rounded-lg p-4">
      <div className="text-xs uppercase text-(--color-description)">
        {label}
      </div>
      <div
        className={
          "text-3xl font-bold mt-1" +
          (unavailable || error ? " text-(--color-description)" : "")
        }
      >
        {display}
      </div>
      {(hint || error) && (
        <small className="block mt-1 text-xs text-(--color-description)">
          {error ? "Ошибка загрузки" : hint}
        </small>
      )}
    </div>
  );
}
