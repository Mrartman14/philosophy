// src/app/admin/forbidden.tsx
import { getT } from "@/i18n";

export default async function AdminForbidden() {
  const t = await getT("admin");
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-bold">{t("forbiddenTitle")}</h1>
      <p className="text-(--color-fg-muted)">
        {t("forbiddenDescription")}
      </p>
    </div>
  );
}
