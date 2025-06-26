"use client";

import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

import { PhilosopherView } from "./philosopher-view";
import { structure } from "@/utils/structure";

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
    imageSrc: "/philosophers/parmenides.jpg",
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

export const PhilosophersTimeline: React.FC<PhilosophersTimelineProps> = () => {
  const [{ height, width }, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const width = document.documentElement.clientWidth / 1.5;
    const height = document.documentElement.clientHeight / 1.5 - 50;
    setSize({ width, height });
  }, []);

  const [transform, setTransform] = useState(d3.zoomIdentity);
  const svgRef = useRef<SVGSVGElement>(null);

  const minYear = Math.min(...data.map((d) => d.from));
  const maxYear = Math.max(...data.map((d) => d.to));
  const virtualWidth = width * 1;
  const xScale = d3
    .scaleLinear()
    .domain([minYear, maxYear])
    .range([60, virtualWidth - 60]);

  // const introLessons = structure.filter((x) => x.section === "Интро");
  // const lessons = data.filter((x) =>
  //   introLessons.some((y) => y.mentions.includes(x.name))
  // );
  // const points = lessons.map(
  //   (x) => [xScale((x.from + x.to) / 2), height - 60] as [number, number]
  // );

  // const d = points
  //   .map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`))
  //   .join(" ");

  // const lineGenerator = d3.line();
  // const qweee = qwe.map(
  //   (x) => [xScale((x.from + x.to) / 2), height - 60] as [number, number]
  // );
  // const pathData = lineGenerator(qweee);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => setTransform(event.transform));
    svg.call(zoom);
  }, []);

  const tickStep = 50;
  const ticks = [];
  for (
    let year = Math.ceil(minYear / tickStep) * tickStep;
    year <= maxYear;
    year += tickStep
  ) {
    ticks.push(year);
  }

  return (
    <div className="overflow-x-auto w-full border border-(--border) rounded-2xl">
      <svg className="fill-current" ref={svgRef} width={width} height={height}>
        <g transform={transform.toString()}>
          {ticks.map((year) => (
            <g key={year}>
              <line
                x1={xScale(year)}
                x2={xScale(year)}
                y1={height - 40}
                y2={height - 30}
                stroke="#2c6590"
                strokeWidth={1}
              />
              <text x={xScale(year)} y={height - 15} textAnchor="middle">
                {year < 0 ? `−${Math.abs(year)}` : year}
              </text>
            </g>
          ))}

          <line
            x1={xScale(minYear)}
            x2={xScale(maxYear)}
            y1={height - 40}
            y2={height - 40}
            stroke="#2c6590"
            strokeWidth={2}
          />

          {data.map((philosopher) => (
            <PhilosopherView
              scale={transform.k}
              key={philosopher.name}
              x={Math.trunc(xScale((philosopher.from + philosopher.to) / 2))}
              y={Math.trunc(height - 40)}
              philosopher={philosopher}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
