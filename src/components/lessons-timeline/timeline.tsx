"use client";

import * as d3 from "d3";
import groupBy from "lodash/groupBy";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { structure } from "@/utils/structure";
import { PhilosopherView } from "./philosopher-view";
import { philosophers } from "@/utils/philosophers";
import { getColorFromString } from "@/utils/get-color-from-str";

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

  const minYear = Math.min(...philosophers.map((d) => d.from));
  const maxYear = Math.max(...philosophers.map((d) => d.to));
  const virtualWidth = width * 1;
  const xScale = d3
    .scaleLinear()
    .domain([minYear, maxYear])
    .range([60, virtualWidth - 60]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => setTransform(event.transform));
    svg.call(zoom);
  }, []);

  const d = useMemo(() => {
    const coords = philosophers.map((philosopher) => ({
      ...philosopher,
      x: Math.trunc(xScale((philosopher.from + philosopher.to) / 2)),
      y: Math.trunc(height - 40),
    }));

    const groupedByChapter = groupBy(structure, (x) => x.section);

    const paths = Object.entries(groupedByChapter).map(
      ([ch, lessons], index) => {
        const yGap = (index + 1) * 20;
        let points: { point: { x: number; y: number }; lesson: string }[] = [
          {
            lesson: lessons[0]!.title,
            point: { x: xScale(minYear), y: height - yGap },
          },
        ];

        lessons
          .toSorted((a, b) => a.order - b.order)
          .forEach((lesson) => {
            lesson.mentions.forEach((mention) => {
              const point = coords
                .filter((x) => x.name === mention)
                .map(({ x, y }) => ({ x, y }));

              points = points.concat(
                point.map((x) => ({ point: x, lesson: lesson.title }))
              );
            });
          });

        const d = points
          .flatMap(({ point }, i) =>
            i === 0
              ? `M${point.x} ${point.y - yGap}`
              : `L${point.x} ${point.y - yGap}`
          )
          .join(" ");
        return { d, color: getColorFromString(ch) };
      }
    );

    return paths;
  }, [height, minYear, xScale]);

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
                stroke="var(--link)"
                strokeWidth={1}
              />
              <text
                x={xScale(year)}
                y={height - 15}
                textAnchor="middle"
                className="text-xs"
              >
                {year < 0 ? `−${Math.abs(year)}` : year}
              </text>
            </g>
          ))}

          <line
            x1={xScale(minYear)}
            x2={xScale(maxYear)}
            y1={height - 40}
            y2={height - 40}
            stroke="var(--link)"
            strokeWidth={2}
          />

          {d.map(({ color, d }) => (
            <g key={color}>
              <path d={d} stroke={color} strokeWidth={2} fill="none" />
            </g>
          ))}

          {philosophers.map((philosopher) => (
            <PhilosopherView
              key={philosopher.name}
              scale={transform.k}
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
