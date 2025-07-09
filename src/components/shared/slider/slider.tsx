import React from "react";
import "./slider.css";

export const Slider: React.FC<{
  items: React.ReactNode[];
  itemClassName?: ((idx: number) => string) | string;
  trackClassName?: string;
  secondsPerItem?: number;
}> = ({ items, itemClassName, trackClassName, secondsPerItem = 4 }) => {
  return (
    <div className="infinite-slider">
      <div
        className={`infinite-slider-track ${trackClassName}`}
        style={{
          animationDuration: `${secondsPerItem * items.length}s`,
        }}
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`${
              typeof itemClassName === "function"
                ? itemClassName(idx)
                : itemClassName
            }`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};
