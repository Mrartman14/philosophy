"use client";

import { useEffect, useState } from "react";
import { GoBack } from "@/components/shared/go-back";
import { OfflineIcon } from "@/assets/icons/offline-icon";
import { lectureService } from "@/services/lecture-service/lecture-service";

export default function Page() {
  const [viewedIds, setViewedIds] = useState<string[]>([]);

  useEffect(() => {
    lectureService.getLastViewedLectureIds().then(setViewedIds);
  }, []);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <div className="w-full h-full flex items-center justify-center flex-col gap-6 p-4">
      <h1 className="text-5xl font-bold flex items-center gap-4">
        Нет сети <OfflineIcon />
      </h1>

      {viewedIds.length > 0 && (
        <div className="w-full max-w-md flex flex-col gap-2">
          <p className="text-(--description) text-sm">
            Недавно просмотренные лекции могут быть доступны из кэша:
          </p>
          <ul className="flex flex-col gap-1">
            {viewedIds.map((id) => (
              <li key={id}>
                <a
                  href={`${basePath}/lectures/${id}`}
                  className="text-blue-500 hover:underline"
                >
                  {id}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <GoBack />
    </div>
  );
}
