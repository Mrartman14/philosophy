"use client";

import { useRouter } from "next/navigation";
import type { Lecture } from "@/api/types";

interface LectureSelectorProps {
  lectures: Lecture[];
  selectedId: string | undefined;
  baseHref: string;
  paramName: string;
}

export const LectureSelector: React.FC<LectureSelectorProps> = ({
  lectures,
  selectedId,
  baseHref,
  paramName,
}) => {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) {
      router.push(baseHref);
    } else {
      const params = new URLSearchParams();
      params.set(paramName, value);
      router.push(`${baseHref}?${params.toString()}`);
    }
  };

  return (
    <label className="flex flex-col gap-1 text-sm max-w-md">
      <span>Лекция</span>
      <select
        value={selectedId ?? ""}
        onChange={handleChange}
        className="px-3 py-2 border border-(--color-border) rounded bg-transparent"
      >
        <option value="">— выберите —</option>
        {lectures.map((lecture) => (
          <option key={lecture.id} value={lecture.id}>
            {lecture.title}
          </option>
        ))}
      </select>
    </label>
  );
};
