import { GoBack } from "@/components/shared/go-back";
import { OfflineIcon } from "@/assets/icons/offline-icon";

export default function Page() {
  return (
    <div className="w-full h-full flex items-center justify-center flex-col">
      <h1 className="text-5xl font-bold flex items-center gap-4">
        Нет сети <OfflineIcon />
      </h1>
      <GoBack />
    </div>
  );
}
