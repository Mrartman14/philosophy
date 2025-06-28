"use client";

import * as d3 from "d3";
import groupBy from "lodash/groupBy";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { WidthSlider } from "./width-slider";
import { PhilosopherView } from "./philosopher-view";
import { PageData, structure } from "@/utils/structure";
import { getAverageX } from "@/utils/get-polyline-center";
import { philosophers, Timeline } from "@/utils/philosophers";
import { getColorFromStringWithPrefix } from "@/utils/get-color-from-str";

export type Coordinate = { x: number; y: number };
const getLinePath = (point: Coordinate, i: number) =>
  i === 0 ? `M${point.x} ${point.y}` : `L${point.x} ${point.y}`;
type LessonPoint = {
  point: { x: number; y: number };
  lesson: PageData;
  chapter: string;
  mention: string;
};
const CHAPTER_GAP = 100 as const;
const LESSON_LINE_WIDTH = 5 as const;
const LESSON_GAP = LESSON_LINE_WIDTH + 1;
const LESSON_SKEW = 0 as const;
const PADDING = 0 as const; // 50

type PhilosophersTimelineProps = {
  height?: number;
  width?: number;
};
export const PhilosophersTimeline: React.FC<PhilosophersTimelineProps> = () => {
  const [{ height, width }, setSize] = useState({ width: 0, height: 0 });
  const [virtualWidthK, setVirtualWidthK] = useState(1);

  useEffect(() => {
    const width = document.documentElement.clientWidth / 1;
    const height = document.documentElement.clientHeight / 1 - 50;
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
    .range([PADDING, virtualWidth - PADDING]);

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
    const coords: (Timeline & Coordinate)[] = philosophers.map(
      (philosopher) => ({
        ...philosopher,
        x: Math.trunc(xScale((philosopher.from + philosopher.to) / 2)),
        y: Math.trunc(height - 40),
      })
    );

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
            const mentions: (Timeline & Coordinate)[] = lesson.mentions
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
                lesson,
                chapter,
                mention: name,
              };
              lessonPoints.push(point);

              // перпендикуляр соединения этой точки с точкой философа на стреле времени [1]
              const connectionPoint1: LessonPoint = {
                chapter,
                lesson,
                point: { x, y },
                mention: name,
              };
              const connectionPoint2: LessonPoint = {
                chapter,
                lesson,
                point: { x: x + xGap, y: y - yGap },
                mention: name,
              };
              connectionPoints.push(connectionPoint1);
              connectionPoints.push(connectionPoint2);
            });

            const lessonPoint = {
              chapter,
              lessonPoints,
              lesson: lesson.title,
              connectionPoints,
            };
            lessonsPoints.push(lessonPoint);
          });

        return lessonsPoints;
      }
    );

    return chapterPaths;
  }, [height, xScale]);

  const ticks = useMemo(() => {
    const zoomMap: Record<string, number> = {
      0.05: 1000,
      1: 500,
      2: 100,
      3: 50,
      8: 25,
    };
    let tickStep = 10000;
    const zoomLevels = Object.keys(zoomMap)
      .map(Number)
      .sort((a, b) => b - a);

    for (const k of zoomLevels) {
      if (transform.k >= k) {
        tickStep = zoomMap[k];
        break;
      }
    }

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

  const newXScale = transform.rescaleX(xScale);

  return (
    <div className="relative overflow-x-auto w-full">
      <WidthSlider
        value={virtualWidthK}
        onChange={setVirtualWidthK}
        className="absolute top-2 right-2"
      />
      <svg className="fill-current" ref={svgRef} width={width} height={height}>
        <line
          y1={height - 40}
          y2={height - 40}
          x1={0}
          x2={width}
          stroke="var(--link)"
          strokeWidth={2}
        />

        <g data-id="timestamps">
          {ticks.map((year) => (
            <text
              key={year}
              textAnchor="middle"
              className="text-(--description) font-light"
              x={Math.trunc(newXScale(year))}
              y={Math.trunc(height - 10)}
            >
              {year < 0 ? `-${Math.abs(year)}` : year}
            </text>
          ))}
        </g>

        <g
          data-id="philosophers"
          // transform={`translate(${transform.x}, 0) scale(${transform.k}, 1)`}
        >
          {philosophers.map((philosopher) => (
            <PhilosopherView
              key={philosopher.name}
              scale={transform.k}
              // x={Math.trunc(xScale((philosopher.from + philosopher.to) / 2))}
              x={Math.trunc(newXScale((philosopher.from + philosopher.to) / 2))}
              y={Math.trunc(height - 40)}
              philosopher={philosopher}
            />
          ))}
        </g>

        <g transform={transform.toString()} data-id="lessons">
          {chaptersLines.map((chapterPoints, index) => {
            return (
              <g key={index}>
                {chapterPoints.map(
                  ({
                    lesson,
                    chapter,
                    lessonPoints,
                    // connectionPoints
                  }) => {
                    const isOnePath = lessonPoints.length === 1;
                    const prefixLength = chapter.length + 1;
                    const color = getColorFromStringWithPrefix(
                      `${chapter}-${lesson}`,
                      prefixLength
                    );

                    const node = isOnePath ? (
                      <circle
                        cx={lessonPoints[0]!.point.x}
                        cy={lessonPoints[0]!.point.y}
                        r={LESSON_LINE_WIDTH / 2}
                        fill={color}
                      />
                    ) : (
                      <path
                        key={`${lesson}`}
                        d={lessonPoints
                          .map(({ point }, i) => getLinePath(point, i))
                          .join(" ")}
                        stroke={color}
                        strokeWidth={LESSON_LINE_WIDTH}
                        fill="none"
                      />
                    );

                    // const connectionsD = connectionPoints
                    //   .map(({ point }, i) => getLinePath(point, i))
                    //   .join(" ");

                    const center = {
                      x:
                        getAverageX(lessonPoints.map((point) => point.point)) ??
                        0,
                      y: lessonPoints[0].point.y ?? 0,
                    };

                    return (
                      <g key={lesson}>
                        {node}
                        {transform.k >= 1 && (
                          <>
                            <text
                              x={center.x}
                              y={center.y}
                              className="font-semibold"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={12 / transform.k}
                            >
                              {lesson}
                            </text>
                            {/* <path
                              key={`${lesson}-connector`}
                              d={connectionsD}
                              stroke={color}
                              strokeWidth={0.1}
                              fill="none"
                            /> */}
                          </>
                        )}
                      </g>
                    );
                  }
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
