import Image from "next/image";

import { LessonPageData } from "@/entities/page-data";

export const LessonCard: React.FC<{
  lesson: LessonPageData;
  className?: string;
}> = ({ lesson, className }) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <a
      href={`/lectures/${lesson.slug}`}
      className={`${className} flex group relative rounded-xl border-4 border-(--border) overflow-hidden`}
    >
      <Image
        fill
        alt={`Lecture cover`}
        src={`${basePath}${lesson.cover}`}
        style={{ margin: 0 }}
        className="object-cover transition-transform duration-500 scale-150 group-hover:scale-100 group-focus:scale-100"
      />
      <div className="absolute p-0.5 bottom-2 right-0 w-full bg-(--text-pane)">
        <h3 style={{ margin: 0 }}>
          {lesson.order}. {lesson.title}
        </h3>
      </div>
    </a>
  );
};
