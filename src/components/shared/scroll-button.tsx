"use client";

import { useEffect, useState } from "react";

export const ScrollButton: React.FC<{ className: string }> = ({
  className,
}) => {
  const offset = 10;
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setAtTop(window.scrollY === 0);

      const offsetHeight = document.documentElement.offsetHeight;
      const innerHeight = window.innerHeight;
      const scrollTop = document.documentElement.scrollTop;
      const hasReachedBottom =
        offsetHeight - (innerHeight + scrollTop) <= offset;
      setAtBottom(hasReachedBottom);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={`${className} grid gap-1 items-end`}>
      <button
        aria-label="скролл вверх"
        className={`flex justify-end gap-2 bg-(--text-pane) rounded-full px-4 py-2 md:py-1 md:bg-transparent text-(--description) hover:text-inherit transition-opacity ${
          atTop ? "opacity-0" : "opacity-100"
        }`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <span className="hidden md:inline">{"Вверх"}</span> {"↑"}
      </button>
      <button
        aria-label="скролл вниз"
        className={`flex justify-end gap-2 bg-(--text-pane) rounded-full px-4 py-2 md:py-1 md:bg-transparent text-(--description) hover:text-inherit transition-opacity ${
          atBottom ? "opacity-0" : "opacity-100"
        }`}
        onClick={() =>
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth",
          })
        }
      >
        <span className="hidden md:inline">{"Вниз"}</span> {"↓"}
      </button>
    </div>
  );
};
