"use client";

import { BookmarkIcon } from "@/assets/icons/bookmark-icon";
import { BookmarkFilledIcon } from "@/assets/icons/bookmark-filled-icon";

type FavButtonProps = {
  className?: string;
  isFav?: boolean;
  onSelect?: VoidFunction;
};
export const FavButton: React.FC<FavButtonProps> = ({
  isFav,
  onSelect,
  className = "",
}) => {
  return (
    <button
      className={`flex items-center justify-center px-2 py-2 rounded-full bg-(--text-pane) ${className}`}
      onClick={onSelect}
    >
      {isFav ? <BookmarkFilledIcon /> : <BookmarkIcon />}
    </button>
  );
};
