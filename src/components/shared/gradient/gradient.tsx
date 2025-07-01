"use client";

import { useLayoutEffect } from "react";

export const Gradient: React.FC = () => {
  useLayoutEffect(() => {
    const canvas = document.getElementById("gradient-bg") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    let time = 0;

    function R(x: number, y: number, t: number) {
      return Math.floor(192 + 64 * Math.cos((x * x - y * y) / 300 + t));
    }
    function G(x: number, y: number, t: number) {
      return Math.floor(
        192 +
          64 *
            Math.sin((x * x * Math.cos(t / 4) + y * y * Math.sin(t / 3)) / 300)
      );
    }
    function B(x: number, y: number, t: number) {
      return Math.floor(
        192 +
          64 *
            Math.sin(
              5 * Math.sin(t / 9) + ((x - 100) ** 2 + (y - 100) ** 2) / 1100
            )
      );
    }

    function draw() {
      if (!ctx) {
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      const grid = 32;
      const cellW = w / grid;
      const cellH = h / grid;
      for (let x = 0; x < grid; x++) {
        for (let y = 0; y < grid; y++) {
          ctx.fillStyle = `rgb(${R(x, y, time)},${G(x, y, time)},${B(
            x,
            y,
            time
          )})`;
          ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
        }
      }
      time += 0.0025;
      // time += 0.03;
      requestAnimationFrame(draw);
    }
    draw();

    function resizeCanvas() {
      if (!ctx) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <canvas
      id="gradient-bg"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        opacity: 0.05,
        width: "100vw",
        height: "100vh",
        zIndex: -1,
      }}
    />
  );
};
