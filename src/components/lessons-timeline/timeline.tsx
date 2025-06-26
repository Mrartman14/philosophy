"use client";

import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

import { PhilosopherView } from "./philosopher-view";

export type Timeline = {
  name: string;
  from: number;
  to: number;
  level: number;
  imageSrc?: string;
};
const data: Timeline[] = [
  {
    name: "Пифагор",
    from: -570,
    to: -490,
    level: 0,
    imageSrc: "/philosophers/pythagoras.jpg",
  },
  {
    name: "Парменид",
    from: -540,
    to: -470,
    level: 0,
    imageSrc: "/philosophers/parmenides.jpeg",
  },
  {
    name: "Гераклит",
    from: -544,
    to: -483,
    level: 0,
    imageSrc: "/philosophers/heraclitus.jpg",
  },
  {
    name: "Зенон",
    from: -490,
    to: -425,
    level: 0,
    imageSrc: "/philosophers/zenon.jpg",
  },
  {
    name: "Платон",
    from: -427,
    to: -347,
    level: 0,
    imageSrc: "/philosophers/plato.jpg",
  },
  {
    name: "Аристотель",
    from: -384,
    to: -322,
    level: 0,
    imageSrc: "/philosophers/aristotle.jpg",
  },
  {
    name: "Эпикур",
    from: -341,
    to: -270,
    level: 0,
    imageSrc: "/philosophers/epicurus.jpg",
  },
  {
    name: "Сократ",
    from: -469,
    to: -399,
    level: 0,
    imageSrc: "/philosophers/socrates.jpg",
  },
];

type PhilosophersTimelineProps = {
  height?: number;
  width?: number;
};
export const PhilosophersTimeline: React.FC<PhilosophersTimelineProps> = ({
  height = 800,
  width = 1000,
}) => {
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const svgRef = useRef<SVGSVGElement>(null);

  // Вычисляем шкалу времени
  const minYear = Math.min(...data.map((d) => d.from));
  const maxYear = Math.max(...data.map((d) => d.to));
  const virtualWidth = width * 3;
  const xScale = d3
    .scaleLinear()
    .domain([minYear, maxYear])
    .range([60, virtualWidth - 60]);

  // D3 Zoom
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => setTransform(event.transform));
    svg.call(zoom);
  }, []);

  // Ось времени
  const axisRef = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!axisRef.current) return;
    const axis = d3.axisBottom(xScale).tickFormat((d) => {
      const q = d as number;
      return `${q < 0 ? "−" + Math.abs(q) : q} г.`;
    });
    d3.select(axisRef.current).call(axis);
  }, [xScale]);

  return (
    <div className="overflow-x-auto w-full border border-(--border) rounded-2xl">
      <svg ref={svgRef} width={width} height={height}>
        <g transform={transform.toString()}>
          {/* Ось времени */}
          <g ref={axisRef} transform={`translate(0, ${height - 40})`} />
          {/* Прямая времени */}
          <line
            x1={xScale(minYear)}
            x2={xScale(maxYear)}
            y1={height - 40}
            y2={height - 40}
            stroke="#333"
            strokeWidth={2}
          />
          {/* Точки-философы как React-компоненты */}
          {data.map((philosopher) => (
            <PhilosopherView
              key={philosopher.name}
              x={xScale((philosopher.from + philosopher.to) / 2)}
              y={height - 40}
              philosopher={philosopher}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
