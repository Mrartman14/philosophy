"use client";

import React, { useState, useEffect, useCallback } from "react";

import "./carousel.css";

type CarouselProps = {
  slides: React.ReactNode[];
  interval?: number;
};
export const Carousel: React.FC<CarouselProps> = ({
  slides,
  interval = 3000,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  }, [slides.length]);

  // const prevSlide = () => {
  //   setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  // };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  useEffect(() => {
    if (typeof interval !== "number") return;

    const timer = setInterval(nextSlide, interval);
    return () => clearInterval(timer);
  }, [currentSlide, interval, nextSlide]);

  return (
    <div className={"carousel"}>
      <div
        className={"carousel-inner"}
        style={{
          transform: `translateX(calc(-${
            currentSlide * 100
          }% - calc(10px * ${currentSlide})))`,
        }}
      >
        {slides.map((slide, index) => (
          <div key={index} className={"carousel-slide"}>
            {slide}
          </div>
        ))}
      </div>
      <div className={"carousel-indicators"}>
        {slides.map((_, index) => (
          <button
            key={index}
            className={`carousel-indicator ${
              index === currentSlide ? "active" : ""
            }`}
            onClick={() => goToSlide(index)}
          />
        ))}
      </div>
    </div>
  );
};
