"use client";

import { useEffect, useState } from "react";

import "./scroll-progress-bar.css";

type ScrollProgressBarProps = {
  className?: string;
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

      // Если элемент помещается в экран — прогресс всегда 0
      if (totalHeight <= windowHeight) {
        setProgress(0);
        return;
      }

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
    <progress
      max={100}
      value={progress}
      aria-label="reading progress"
      className={`scroll-progress-bar w-full bg-transparent overflow-hidden ${
        progress > 0 ? "h-1" : "h-0"
      } ${className}`}
    />
  );
};
