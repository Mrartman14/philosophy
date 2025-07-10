import Link from "next/link";
import Image from "next/image";

import { LessonPageData } from "@/entities/page-data";

export const LessonCard: React.FC<{
  lesson: LessonPageData;
  className?: string;
  style?: React.CSSProperties;
}> = ({ lesson, className, style }) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <Link
      href={`/lectures/${lesson.slug}`}
      className={`flex group relative rounded-xl overflow-hidden ${className} `}
      style={style}
      title={lesson.title}
    >
      <Image
        fill
        alt={`Lecture cover`}
        src={`${basePath}${lesson.cover}`}
        style={{ margin: 0 }}
        className="sensitive-image object-cover transition-transform duration-500 scale-150 group-hover:scale-100 group-focus:scale-100"
      />
      <div className="absolute py-0.5 px-2 bottom-2 right-0 w-full bg-(--text-pane)">
        <h3
          className="text-md md:text-2xl whitespace-nowrap text-ellipsis overflow-hidden"
          style={{ margin: 0 }}
        >
          {lesson.order}. {lesson.title}
        </h3>
      </div>
    </Link>
  );
};
