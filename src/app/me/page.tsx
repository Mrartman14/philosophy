// src/app/me/page.tsx
import { requireUserOrRedirect } from "@/utils/me";

export const metadata = { title: "Личный кабинет" };

export default async function MePage() {
  const me = await requireUserOrRedirect("/me");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 p-6">
      <h1 className="text-2xl font-bold">{me.username}</h1>
      <p className="text-sm text-(--color-description)">Выберите раздел выше.</p>
    </div>
  );
}
