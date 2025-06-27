"use client";

import * as d3 from "d3";
import groupBy from "lodash/groupBy";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { WidthSlider } from "./width-slider";
import { structure } from "@/utils/structure";
import { philosophers } from "@/utils/philosophers";
import { PhilosopherView } from "./philosopher-view";
import { getColorFromString } from "@/utils/get-color-from-str";

type Point = { x: number; y: number };
const getLinePath = (point: Point, i: number) =>
  i === 0 ? `M${point.x} ${point.y}` : `L${point.x} ${point.y}`;
type LessonPoint = {
  point: { x: number; y: number };
  lesson: string;
  chapter: string;
};
const LEVEL_HEIGHT = 30 as const;

type PhilosophersTimelineProps = {
  height?: number;
  width?: number;
};
export const PhilosophersTimeline: React.FC<PhilosophersTimelineProps> = () => {
  const [{ height, width }, setSize] = useState({ width: 0, height: 0 });
  const [virtualWidthK, setVirtualWidthK] = useState(2);

  useEffect(() => {
    const width = document.documentElement.clientWidth / 1.5;
    const height = document.documentElement.clientHeight / 1.5 - 50;
    setSize({ width, height });
  }, []);

  const [transform, setTransform] = useState(d3.zoomIdentity);
  const svgRef = useRef<SVGSVGElement>(null);

  const minYear = Math.min(...philosophers.map((d) => d.from));
  const maxYear = Math.max(...philosophers.map((d) => d.to));
  const virtualWidth = width * virtualWidthK;
  const xScale = d3
    .scaleLinear()
    .domain([minYear, maxYear])
    .range([60, virtualWidth - 60]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 15])
      .on("zoom", (event) => setTransform(event.transform));
    svg.call(zoom);
  }, []);

  const lessonLines = useMemo(() => {
    const coords = philosophers.map((philosopher) => ({
      ...philosopher,
      x: Math.trunc(xScale((philosopher.from + philosopher.to) / 2)),
      y: Math.trunc(height - 40),
    }));

    const groupedByChapter = groupBy(structure, (x) => x.section);

    const chapterPaths = Object.entries(groupedByChapter).map(
      ([ch, lessons], index) => {
        const yGap = (index + 1) * LEVEL_HEIGHT;
        let points: LessonPoint[] = [];
        const connectionPoints: LessonPoint[][] = [];

        lessons
          .toSorted((a, b) => a.order - b.order)
          .forEach((lesson) => {
            lesson.mentions.forEach((mention) => {
              const lessonPoints = coords
                .filter((x) => x.name === mention)
                .map(({ x, y }) => {
                  // точка урока, лежащая параллельно стреле времени и перпендикулярно философу на стреле времени
                  const point: LessonPoint = {
                    point: {
                      x,
                      y: y - yGap,
                    },
                    lesson: lesson.title,
                    chapter: ch,
                  };

                  // перпендикуляр соединения этой точки с точкой философа на стреле времени [1]
                  const connectionPoint1: LessonPoint = {
                    chapter: ch,
                    lesson: lesson.title,
                    point: { x, y },
                  };
                  const connectionPoint2: LessonPoint = {
                    chapter: ch,
                    lesson: lesson.title,
                    point: { x, y: y - yGap },
                  };
                  connectionPoints.push([connectionPoint1, connectionPoint2]);

                  return point;
                });

              points = points.concat(lessonPoints);
            });
          });

        return {
          points,
          connectionPoints,
          color: getColorFromString(ch),
        };
      }
    );

    return chapterPaths;
  }, [height, xScale]);

  const ticks = useMemo(() => {
    const tickStep = transform.k > 1.5 ? 100 : 500;
    const result = [];
    for (
      let year = Math.ceil(minYear / tickStep) * tickStep;
      year <= maxYear;
      year += tickStep
    ) {
      result.push(year);
    }
    return result;
  }, [maxYear, minYear, transform.k]);

  return (
    <div className="relative overflow-x-auto w-full border border-(--border) rounded-2xl">
      <WidthSlider
        value={virtualWidthK}
        onChange={setVirtualWidthK}
        className="absolute top-2 right-2"
      />
      <svg className="fill-current" ref={svgRef} width={width} height={height}>
        <g transform={transform.toString()}>
          {transform.k > 0.5 &&
            ticks.map((year) => (
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
                  fontSize={12 / transform.k}
                >
                  {year < 0 ? `-${Math.abs(year)}` : year}
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

          {lessonLines.map(({ color, points, connectionPoints }) => {
            const d = points
              .flatMap(({ point }, i) => getLinePath(point, i))
              .join(" ");

            const connectionsD = connectionPoints.map((points) =>
              points.flatMap(({ point }, i) => getLinePath(point, i)).join(" ")
            );

            return (
              <g key={color}>
                <path d={d} stroke={color} strokeWidth={2} fill="none" />
                {connectionsD.map((path) => (
                  <path
                    key={path}
                    d={path}
                    stroke={color}
                    strokeWidth={2}
                    fill="none"
                  />
                ))}
              </g>
            );
          })}

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
