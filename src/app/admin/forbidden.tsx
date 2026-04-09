import Link from "next/link";

export const metadata = { title: "Нет доступа — Админ" };

export default function AdminForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Нет доступа</h1>
      <p className="text-sm text-(--color-description) max-w-md">
        У вас недостаточно прав для просмотра этой страницы админ-панели.
        Если вы считаете, что это ошибка — обратитесь к администратору.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded border border-(--color-border) text-sm hover:bg-(--color-text-pane)"
      >
        ← На главную
      </Link>
    </div>
  );
}
