"use client";

import { useEffect, useState } from "react";

export const ScrollButton: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  const offset = 10;
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setAtTop(window.scrollY <= 0);

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

  const btnClassName = `flex justify-end gap-2 bg-(--text-pane) rounded-full px-4 py-2 md:py-1 text-(--description) hover:text-inherit transition-opacity`;
  return (
    <div className={`${className} gap-1 flex select-none`}>
      <button
        aria-label="скролл вверх"
        className={`${btnClassName} ${atTop ? "opacity-0" : "opacity-100"}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <span className="hidden md:inline">{"Вверх"}</span> {"↑"}
      </button>
      <button
        aria-label="скролл вниз"
        className={`${btnClassName} ${atBottom ? "opacity-0" : "opacity-100"}`}
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
