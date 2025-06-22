"use client";

import { useEffect, useState } from "react";

type ScrollProgressBarProps = {};
export const ScrollProgressBar: React.FC<ScrollProgressBarProps> = () => {
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
    <div className="left-0 w-full h-1 bg-blue-300 z-50 rounded">
      <div
        className="h-full bg-blue-500 rounded"
        style={{ width: `${scroll}%` }}
      />
    </div>
  );
};
