import Link from "next/link";
import Image from "next/image";

import { LessonPageData } from "@/entities/page-data";
import { FavButton } from "@/components/shared/fav-button/fav-button";
import { ShareButton } from "@/components/shared/share-button/share-button";

export const LessonCard: React.FC<{
  lesson: LessonPageData;
  className?: string;
  isFav?: boolean;
  onSelectFav?: VoidFunction;
  style?: React.CSSProperties;
}> = ({ lesson, className = "", style, isFav, onSelectFav }) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <div
      className={`relative group grid grid-rows-[1fr_auto] bg-(--background) ${className}`}
    >
      <Link
        href={`/lectures/${lesson.slug}`}
        className={`relative flex overflow-hidden rounded-xl`}
        style={style}
        title={lesson.title}
      >
        <Image
          fill
          alt={`Lecture cover`}
          src={`${basePath}${lesson.cover}`}
          className="sensitive-image object-cover transition-transform duration-500 scale-150 group-hover:scale-100 group-focus:scale-100"
        />
      </Link>
      <div className="absolute top-2 right-2 flex gap-2 transition-all">
        <ShareButton
          shareData={{ title: lesson.title }}
          className="md:hidden group-hover:flex group-focus:flex"
        />
        <FavButton
          isFav={isFav}
          onSelect={onSelectFav}
          className={`${
            !isFav ? "md:hidden" : ""
          } group-hover:flex group-focus:flex`}
        />
      </div>
      <div className="text-xl pt-2 px-0 overflow-hidden flex items-center gap-1 justify-between">
        <h3 className="font-semibold text-ellipsis overflow-hidden whitespace-nowrap">
          {lesson.title}
        </h3>
      </div>
    </div>
  );
};
