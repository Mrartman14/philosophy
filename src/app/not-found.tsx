import { GoBack } from "@/components/shared/go-back";
import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

export default async function NotFound() {
  const t = await getT("pages");
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">{t("notFoundTitle")}</h1>
      <RouterLink href="/" className="underline text-2xl">
        {t("notFoundHome")}
      </RouterLink>
      <GoBack />
    </div>
  );
}
