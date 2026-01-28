import React, { useRef, useEffect, useState } from "react";

type MarqueeProps = {
  trackClassName?: string;
  itemClassName?: string;
  pxPerSeconds?: number;
  items: React.ReactNode[];
};
export const Marquee: React.FC<MarqueeProps> = ({
  items,
  pxPerSeconds = 1,
  trackClassName,
  itemClassName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setPaused] = useState(false);

  const dubbedItems = [...items, ...items];

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

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    if (!prefersReducedMotion) {
      el.addEventListener("scroll", onScroll);
    }
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto whitespace-nowrap overscroll-x-contain grid grid-rows-1"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => {
        setTimeout(() => setPaused(false), 1000);
      }}
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
