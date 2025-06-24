"use client";

import { useEffect, useState } from "react";

type ScrollProgressBarProps = { className?: string };
export const ScrollProgressBar: React.FC<ScrollProgressBarProps> = ({
  className,
}) => {
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const height =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      const scrolled = (scrollTop / height) * 100;
      setScroll(scrolled);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={`w-full h-1 bg-(--border) rounded ${className}`}>
      <div
        className="h-full bg-(--primary) rounded"
        style={{ width: `${scroll}%` }}
      />
    </div>
  );
};
