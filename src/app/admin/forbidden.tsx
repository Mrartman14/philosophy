// src/app/admin/forbidden.tsx
export default function AdminForbidden() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-bold">403</h1>
      <p className="text-(--color-description)">
        Доступ к админ-панели запрещён.
      </p>
    </div>
  );
}
