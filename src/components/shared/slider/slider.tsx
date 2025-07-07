import React from "react";
import "./slider.css";

export const Slider: React.FC<{
  items: React.ReactNode[];
  itemWidth?: number;
  secondsPerItem?: number;
}> = ({ items, secondsPerItem = 4, itemWidth = 300 }) => {
  return (
    <div className="infinite-slider">
      <div
        className="infinite-slider-track gap-4"
        style={{
          animationDuration: `${secondsPerItem * items.length}s`,
        }}
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            className="slider-item"
            style={{ flex: `0 0 ${itemWidth}px` }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};
