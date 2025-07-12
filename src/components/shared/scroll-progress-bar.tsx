"use client";

import { useEffect, useState } from "react";

type ScrollProgressBarProps = {
  className?: string | ((percentage: number) => string);
  targetElementId: string;
};

export const ScrollProgressBar: React.FC<ScrollProgressBarProps> = ({
  className,
  targetElementId,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const target = document.getElementById(targetElementId);
    if (!target) return;

    const handleScroll = () => {
      const rect = target.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const totalHeight = target.offsetHeight;

      // расстояние от верхней границы экрана до верхней границы элемента
      const distanceFromTop = window.scrollY + rect.top;

      const scrolled = Math.min(
        Math.max(
          (window.scrollY - distanceFromTop) / (totalHeight - windowHeight),
          0
        ),
        1
      );

      setProgress(scrolled * 100);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [targetElementId]);

  return (
    <div
      className={`${
        typeof className === "function" ? className(progress) : className
      }`}
    >
      <div
        className="h-full bg-(--primary)"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

// bg-(--border)
