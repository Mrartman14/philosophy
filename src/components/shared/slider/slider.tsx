import React from "react";
import "./slider.css";

export const Slider: React.FC<{
  items: React.ReactNode[];
  itemClassName?: string;
  secondsPerItem?: number;
}> = ({ items, itemClassName, secondsPerItem = 4 }) => {
  return (
    <div className="infinite-slider">
      <div
        className="infinite-slider-track gap-4"
        style={{
          animationDuration: `${secondsPerItem * items.length}s`,
        }}
      >
        {items.map((item, idx) => (
          <div key={idx} className={`${itemClassName}`}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};
