"use client";

import groupBy from "lodash/groupBy";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, select, zoom as d3Zoom, zoomIdentity } from "d3";

import { WidthSlider } from "./width-slider";
import { PhilosopherView } from "./philosopher-view";
import { LecturePageData } from "@/entities/page-data";
import { getAverageX } from "@/utils/get-polyline-center";
import { philosophers, Timeline } from "@/utils/philosophers";
import { getColorFromStringWithPrefix } from "@/utils/get-color-from-str";

export type Coordinate = { x: number; y: number };
const getLinePath = (point: Coordinate, i: number) =>
  i === 0 ? `M${point.x} ${point.y}` : `L${point.x} ${point.y}`;
type LecturePoint = {
  point: { x: number; y: number };
  lecture: LecturePageData;
  chapter: string;
  mention: string;
};
const CHAPTER_GAP = 100 as const;
const LECTURE_LINE_WIDTH = 5 as const;
const LECTURE_GAP = LECTURE_LINE_WIDTH + 1;
const LECTURE_SKEW = 0 as const;
const PADDING = 0 as const; // 50
const TIMELINE_BOTTOM_OFFSET = 150;

type PhilosophersTimelineProps = {
  lectures: LecturePageData[];
};
export const PhilosophersTimeline: React.FC<PhilosophersTimelineProps> = ({
  lectures,
}) => {
  const [{ height, width }, setSize] = useState({ width: 0, height: 0 });
  const [virtualWidthK, setVirtualWidthK] = useState(1);

  useEffect(() => {
    const width = document.documentElement.clientWidth / 1;
    const height = document.documentElement.clientHeight / 1 - 50;
    setSize({ width, height });
  }, []);

  const [transform, setTransform] = useState(zoomIdentity);
  const svgRef = useRef<SVGSVGElement>(null);

  const minYear = Math.min(...philosophers.map((d) => d.from));
  const maxYear = Math.max(...philosophers.map((d) => d.to));
  const virtualWidth = width * virtualWidthK;
  const xScale = scaleLinear()
    .domain([minYear, maxYear])
    .range([PADDING, virtualWidth - PADDING]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const zoom = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 15])
      .on("zoom", (event) => setTransform(event.transform));
    svg.call(zoom);
  }, []);

  const chaptersLines = useMemo(() => {
    const coords: (Timeline & Coordinate)[] = philosophers.map(
      (philosopher) => ({
        ...philosopher,
        x: Math.trunc(xScale((philosopher.from + philosopher.to) / 2)),
        y: Math.trunc(height - TIMELINE_BOTTOM_OFFSET),
      })
    );

    const groupedByChapter = groupBy(lectures, (x) => x.section);

    const chapterPaths = Object.entries(groupedByChapter).map(
      ([chapter, lectures], chapterIndex) => {
        const xGap = chapterIndex * LECTURE_SKEW;
        const orderedLectures = lectures.toSorted((a, b) => a.order - b.order);

        const lecturesPoints: {
          chapter: string;
          lecture: string;
          lecturePoints: LecturePoint[];
          connectionPoints: LecturePoint[];
        }[] = [];

        orderedLectures
          .toSorted((a, b) => a.order - b.order)
          .forEach((lecture, lectureIndex) => {
            const yGap =
              (chapterIndex + 1) * CHAPTER_GAP + lectureIndex * LECTURE_GAP;

            // все кого упомянули на уроке
            const mentions: (Timeline & Coordinate)[] = lecture.mentions
              .map((m) => coords.find((x) => x.name === m) ?? null)
              .filter((x) => x !== null);

            const lecturePoints: LecturePoint[] = [];
            const connectionPoints: LecturePoint[] = [];

            mentions.forEach(({ x, y, name }) => {
              // точка урока, лежащая параллельно стреле времени и перпендикулярно философу на стреле времени
              const point: LecturePoint = {
                point: {
                  x: x + xGap,
                  y: y - yGap,
                },
                lecture: lecture,
                chapter,
                mention: name,
              };
              lecturePoints.push(point);

              // перпендикуляр соединения этой точки с точкой философа на стреле времени [1]
              const connectionPoint1: LecturePoint = {
                chapter,
                lecture: lecture,
                point: { x, y },
                mention: name,
              };
              const connectionPoint2: LecturePoint = {
                chapter,
                lecture: lecture,
                point: { x: x + xGap, y: y - yGap },
                mention: name,
              };
              connectionPoints.push(connectionPoint1);
              connectionPoints.push(connectionPoint2);
            });

            const lecturePoint = {
              chapter,
              lecturePoints,
              lecture: lecture.title,
              connectionPoints,
            };
            lecturesPoints.push(lecturePoint);
          });

        return lecturesPoints;
      }
    );

    return chapterPaths;
  }, [height, xScale, lectures]);

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
        <g transform={transform.toString()} data-id="lectures">
          {chaptersLines.map((chapterPoints, index) => {
            return (
              <g key={index}>
                {chapterPoints.map(
                  ({
                    lecture,
                    chapter,
                    lecturePoints,
                    // connectionPoints
                  }) => {
                    const isOnePath = lecturePoints.length === 1;
                    const prefixLength = chapter.length + 1;
                    const color = getColorFromStringWithPrefix(
                      `${chapter}-${lecture}`,
                      prefixLength
                    );

                    const node = isOnePath ? (
                      <circle
                        cx={lecturePoints[0]!.point.x}
                        cy={lecturePoints[0]!.point.y}
                        r={LECTURE_LINE_WIDTH / 2}
                        fill={color}
                      />
                    ) : (
                      <path
                        key={`${lecture}`}
                        d={lecturePoints
                          .map(({ point }, i) => getLinePath(point, i))
                          .join(" ")}
                        stroke={color}
                        strokeWidth={LECTURE_LINE_WIDTH}
                        fill="none"
                      />
                    );

                    // const connectionsD = connectionPoints
                    //   .map(({ point }, i) => getLinePath(point, i))
                    //   .join(" ");

                    const center = {
                      x:
                        getAverageX(
                          lecturePoints.map((point) => point.point)
                        ) ?? 0,
                      y: lecturePoints[0].point.y ?? 0,
                    };

                    return (
                      <g key={lecture}>
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
                              {lecture}
                            </text>
                            {/* <path
                              key={`${lecture}-connector`}
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

        <line
          y1={height - TIMELINE_BOTTOM_OFFSET}
          y2={height - TIMELINE_BOTTOM_OFFSET}
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
              y={Math.trunc(height - TIMELINE_BOTTOM_OFFSET + 40)}
            >
              {year < 0 ? `-${Math.abs(year)}` : year}
            </text>
          ))}
        </g>

        <g data-id="philosophers">
          {philosophers.map((philosopher) => (
            <PhilosopherView
              key={philosopher.name}
              scale={transform.k}
              x={Math.trunc(newXScale((philosopher.from + philosopher.to) / 2))}
              y={Math.trunc(height - TIMELINE_BOTTOM_OFFSET)}
              philosopher={philosopher}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
