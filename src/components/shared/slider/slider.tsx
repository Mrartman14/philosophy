import React, { useRef, useEffect, useState, useMemo } from "react";

type SliderProps = {
  trackClassName?: string;
  itemClassName?: string;
  pxPerSeconds?: number;
  items: React.ReactNode[];
};
export const Slider: React.FC<SliderProps> = ({
  items,
  pxPerSeconds = 1,
  trackClassName,
  itemClassName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setPaused] = useState(false);

  const dubbedItems = useMemo(() => [...items, ...items], [items]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let animationFrameId: number;

    const animate = () => {
      if (!isPaused) {
        el.scrollLeft += pxPerSeconds;
        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft = 0;
        }
        if (el.scrollLeft < 0) {
          el.scrollLeft = el.scrollWidth / 2;
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused, pxPerSeconds]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (el.scrollLeft >= el.scrollWidth / 2) {
        el.scrollLeft = 0;
      }

      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      const isOverScroll = el.scrollLeft < 0 || el.scrollLeft > maxScrollLeft;

      if (isOverScroll) {
        el.scrollLeft = el.scrollWidth / 2;
      }
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // useEffect(() => {
  //   const el = containerRef.current;
  //   if (!el) return;

  //   let timeout: NodeJS.Timeout;

  //   const handleScroll = () => {
  //     setPaused(true);
  //     clearTimeout(timeout);
  //     timeout = setTimeout(() => setPaused(false), 2000);
  //   };

  //   el.addEventListener("scroll", handleScroll);
  //   return () => {
  //     el.removeEventListener("scroll", handleScroll);
  //     clearTimeout(timeout);
  //   };
  // }, []);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto whitespace-nowrap overscroll-x-contain grid grid-rows-1"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => {
        setTimeout(() => setPaused(false), 200);
      }}
      // style={{ scrollbarColor: "transparent transparent" }}
    >
      <div className={`flex w-max ${trackClassName}`}>
        {dubbedItems.map((item, idx) => (
          <div key={idx} className={`${itemClassName}`}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};
