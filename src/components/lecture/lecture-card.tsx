import Link from "next/link";
import Image from "next/image";

import { LecturePageData } from "@/entities/page-data";
import { FavButton } from "@/components/shared/fav-button/fav-button";
import { ShareButton } from "@/components/shared/share-button/share-button";

export const LectureCard: React.FC<{
  lecture: LecturePageData;
  className?: string;
  isFav?: boolean;
  onSelectFav?: VoidFunction;
  style?: React.CSSProperties;
}> = ({ lecture, className = "", style, isFav, onSelectFav }) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <article
      className={`relative group grid grid-rows-[1fr_auto] bg-(--background) ${className}`}
    >
      <Link
        href={`/lectures/${lecture.slug}`}
        className={`relative flex overflow-hidden rounded-xl`}
        style={style}
        title={lecture.title}
      >
        <Image
          fill
          alt={`Lecture cover`}
          src={`${basePath}${lecture.cover}`}
          className="sensitive-image object-cover transition-transform duration-500 scale-150 group-hover:scale-100 group-focus:scale-100"
        />
      </Link>
      <menu className="absolute top-2 right-2 flex gap-2 transition-all">
        <li>
          <ShareButton
            shareData={{ title: lecture.title }}
            className="md:hidden group-hover:flex group-focus:flex md:text-(--description) md:hover:text-inherit"
          />
        </li>
        <li>
          <FavButton
            isFav={isFav}
            onSelect={onSelectFav}
            className={`${
              !isFav
                ? "md:hidden md:text-(--description) md:hover:text-inherit"
                : "text-(--primary)"
            } group-hover:flex group-focus:flex`}
          />
        </li>
      </menu>
      <div className="text-xl pt-2 px-0 overflow-hidden flex items-center gap-1 justify-between">
        <h3 className="font-semibold text-ellipsis overflow-hidden whitespace-nowrap">
          {lecture.title}
        </h3>
      </div>
    </article>
  );
};
