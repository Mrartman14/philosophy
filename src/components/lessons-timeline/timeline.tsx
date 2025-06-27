"use client";

import * as d3 from "d3";
import groupBy from "lodash/groupBy";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { WidthSlider } from "./width-slider";
import { structure } from "@/utils/structure";
import { philosophers, Timeline } from "@/utils/philosophers";
import { PhilosopherView } from "./philosopher-view";
// import { getColorFromString } from "@/utils/get-color-from-str";

type Point = { x: number; y: number };
const getLinePath = (point: Point, i: number) =>
  i === 0 ? `M${point.x} ${point.y}` : `L${point.x} ${point.y}`;
type LessonPoint = {
  point: { x: number; y: number };
  lesson: string;
  chapter: string;
  mention: string;
};
const CHAPTER_GAP = 50 as const;
const LESSON_LINE_WIDTH = 2 as const;
const LESSON_GAP = LESSON_LINE_WIDTH + 1;
const LESSON_SKEW = 0 as const;

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

  const chaptersLines = useMemo(() => {
    const coords: (Timeline & Point)[] = philosophers.map((philosopher) => ({
      ...philosopher,
      x: Math.trunc(xScale((philosopher.from + philosopher.to) / 2)),
      y: Math.trunc(height - 40),
    }));

    const groupedByChapter = groupBy(structure, (x) => x.section);

    const chapterPaths = Object.entries(groupedByChapter).map(
      ([chapter, lessons], chapterIndex) => {
        const xGap = chapterIndex * LESSON_SKEW;
        const orderedLessons = lessons.toSorted((a, b) => a.order - b.order);

        const lessonsPoints: {
          chapter: string;
          lesson: string;
          lessonPoints: LessonPoint[];
          connectionPoints: LessonPoint[];
        }[] = [];

        orderedLessons
          .toSorted((a, b) => a.order - b.order)
          .forEach((lesson, lessonIndex) => {
            const yGap =
              (chapterIndex + 1) * CHAPTER_GAP + lessonIndex * LESSON_GAP;

            // все кого упомянули на уроке
            const mentions: (Timeline & Point)[] = lesson.mentions
              .map((m) => coords.find((x) => x.name === m) ?? null)
              .filter((x) => x !== null);

            const lessonPoints: LessonPoint[] = [];
            const connectionPoints: LessonPoint[] = [];

            mentions.forEach(({ x, y, name }) => {
              // точка урока, лежащая параллельно стреле времени и перпендикулярно философу на стреле времени
              const point: LessonPoint = {
                point: {
                  x: x + xGap,
                  y: y - yGap,
                },
                lesson: lesson.title,
                chapter,
                mention: name,
              };
              lessonPoints.push(point);

              // перпендикуляр соединения этой точки с точкой философа на стреле времени [1]
              const connectionPoint1: LessonPoint = {
                chapter,
                lesson: lesson.title,
                point: { x, y },
                mention: name,
              };
              const connectionPoint2: LessonPoint = {
                chapter,
                lesson: lesson.title,
                point: { x: x + xGap, y: y - yGap },
                mention: name,
              };
              connectionPoints.push(connectionPoint1);
              connectionPoints.push(connectionPoint2);
            });

            lessonsPoints.push({
              chapter,
              lessonPoints,
              lesson: lesson.title,
              connectionPoints,
            });
          });

        return lessonsPoints;
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
          {transform.k > 0.5 && (
            <g data-id="timestamps">
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
                    fontSize={12 / transform.k}
                  >
                    {year < 0 ? `-${Math.abs(year)}` : year}
                  </text>
                </g>
              ))}
            </g>
          )}

          <line
            x1={xScale(minYear)}
            x2={xScale(maxYear)}
            y1={height - 40}
            y2={height - 40}
            stroke="var(--link)"
            strokeWidth={2}
          />

          {chaptersLines.map((chapterPoints, index) => {
            // const paths = lessonsPoints.map((points) => {
            //   return points
            //     .map(({ point }, i) => getLinePath(point, i))
            //     .join(" ");
            // });

            // const connectionsD = connectionPoints.map((points) => {
            //   return points
            //     .map(({ point }, i) => getLinePath(point, i))
            //     .join(" ");
            // });

            return (
              <g key={index}>
                {chapterPoints.map(
                  ({ lessonPoints, connectionPoints, lesson, chapter }) => {
                    const lessonPath = lessonPoints
                      .map(({ point }, i) => getLinePath(point, i))
                      .join(" ");
                    const connectionsD = connectionPoints
                      .map(({ point }, i) => getLinePath(point, i))
                      .join(" ");

                    const prefixLength = chapter.length + 1;
                    const color = getColorFromString(
                      `${chapter}-${lesson}`,
                      prefixLength
                    );

                    return (
                      <g key={lesson}>
                        <path
                          key={`${lesson}`}
                          d={lessonPath}
                          stroke={color}
                          strokeWidth={LESSON_LINE_WIDTH}
                          fill="none"
                        />
                        <path
                          key={`${lesson}-connector`}
                          d={connectionsD}
                          stroke={color}
                          strokeWidth={LESSON_LINE_WIDTH}
                          fill="none"
                        />
                      </g>
                    );
                  }
                )}
              </g>
            );
          })}

          <g>
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
        </g>
      </svg>
    </div>
  );
};

function hashToInt(value: string, maxValue: number) {
  // Простая хеш-функция для строки
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // Преобразование в 32-битное целое
  }
  return Math.abs(hash) % maxValue;
}

function getColorFromString(s: string, prefixLength = 3) {
  const prefix = s.substring(0, prefixLength);
  const suffix = s.substring(prefixLength);

  const hue = hashToInt(prefix, 360);
  const saturation = 40 + hashToInt(suffix, 40); // 40–80%
  const lightness = 40 + hashToInt(suffix.split("").reverse().join(""), 30); // 40–70%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
