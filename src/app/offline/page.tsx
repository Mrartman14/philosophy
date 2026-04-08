import { GoBack } from "@/components/shared/go-back";
import { OfflineIcon } from "@/assets/icons/offline-icon";

export default function Page() {
  return (
    <div className="w-full h-full flex items-center justify-center flex-col gap-6 p-4">
      <h1 className="text-5xl font-bold flex items-center gap-4">
        Нет сети <OfflineIcon />
      </h1>
      <p className="text-(--color-description) text-sm">
        Проверьте подключение к интернету и попробуйте снова.
      </p>
      <GoBack />
    </div>
  );
}
