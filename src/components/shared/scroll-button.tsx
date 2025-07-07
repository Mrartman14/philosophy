"use client";

import { useEffect, useState } from "react";

export const ScrollButton: React.FC = () => {
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
    <div className="fixed bottom-4 right-4 md:bottom-10 md:right-10 grid gap-1 items-end">
      <button
        aria-label="скролл вверх"
        className={`flex justify-end gap-2 bg-(--text-pane) rounded-full px-3 py-1 md:px-4 md:bg-transparent text-(--description) transition-opacity ${
          atTop ? "opacity-0" : "opacity-100"
        }`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <span className="hidden md:inline">{"Вверх"}</span> {"↑"}
      </button>
      <button
        aria-label="скролл вниз"
        className={`flex justify-end gap-2 bg-(--text-pane) rounded-full px-3 py-1 md:px-4 md:bg-transparent text-(--description) transition-opacity ${
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
