import { OfflineIcon } from "@/assets/icons/offline-icon";
import { GoBack } from "@/components/shared/go-back";
import { getT } from "@/i18n";

export default async function Page() {
  const t = await getT("pages");
  return (
    <div className="w-full h-full flex items-center justify-center flex-col gap-6 p-4">
      <h1 className="text-5xl font-bold flex items-center gap-4">
        {t("offlineTitle")} <OfflineIcon />
      </h1>
      <p className="text-(--color-fg-muted) text-sm">
        {t("offlineHint")}
      </p>
      <GoBack />
    </div>
  );
}
