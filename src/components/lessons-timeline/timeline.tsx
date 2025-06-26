"use client";

import React from "react";

type Timeline = {
  name: string;
  from: number;
  to: number;
  level: number;
  imageSrc?: string;
};
let philosophers: Timeline[] = [
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

function assignLevels(p: Timeline[]) {
  // Клонируем массив, чтобы не мутировать исходные данные
  const sorted = [...p].sort((a, b) => a.from - b.from);
  const levels = [];
  const result = [];

  for (const philosopher of sorted) {
    let placed = false;
    for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
      // Проверяем, не пересекается ли с кем-то на этом уровне
      if (
        levels[levelIndex].every(
          (p) => philosopher.from > p.to || philosopher.to < p.from
        )
      ) {
        levels[levelIndex].push(philosopher);
        result.push({ ...philosopher, level: levelIndex });
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Новый уровень
      levels.push([philosopher]);
      result.push({ ...philosopher, level: levels.length - 1 });
    }
  }
  return result;
}

function generateCenturyMarks(min: number, max: number, step = 100) {
  const marks: number[] = [];
  // Округляем вниз до ближайшей сотни
  const start = Math.floor(min / step) * step;
  for (let year = start; year <= max; year += step) {
    marks.push(year);
  }
  return marks;
}

philosophers = assignLevels(philosophers);

const scale = 3;
// Определяем минимальный и максимальный год для шкалы
const minYear = Math.min(...philosophers.map((p) => p.from)) - 10;
const maxYear = Math.max(...philosophers.map((p) => p.to)) + 10;
// const totalWidth = Math.abs(minYear) + Math.abs(maxYear);
// const timelineWidth = (maxYear - minYear) * scale;

// const maxLevel = Math.max(...philosophers.map((p) => p.level));
// const LEVEL_HEIGHT = 60;
// const TIMELINE_HEIGHT = 50;
// const containerHeight = 500 + maxLevel * LEVEL_HEIGHT;

const margin = 60;
// const laneHeight = 40;
const svgWidth = (maxYear - minYear) * scale + margin * 2;
const svgHeight = 200;
// const svgHeight =
//   philosophers.reduce((max, p) => Math.max(max, p.level), 0) * laneHeight +
//   margin * 2;

const centuryMarks = generateCenturyMarks(minYear, maxYear);

// Функция для конвертации года до н.э. в строку
function formatYear(year: number) {
  return `${Math.abs(year)} до н.э.`;
}

// TODO: d3 axis для времени https://d3js.org/d3-axis
export const PhilosophersTimeline: React.FC = () => {
  return (
    <svg
      width={svgWidth}
      height={svgHeight * 2}
      className="bg-gray-100 dark:bg-gray-800"
    >
      {/* Линия времени */}
      <line
        x1={margin}
        y1={svgHeight / 2}
        x2={svgWidth - margin}
        y2={svgHeight / 2}
        stroke="#a3a3a3"
        strokeWidth={2}
      />

      {/* <div
          className={`absolute
            h-1 dark:bg-gray-600 rounded
        `}
          style={{
            top: `${TIMELINE_HEIGHT}px`,
            width: `${timelineWidth}px`,
          }}
        /> */}
      {centuryMarks.map((year) => {
        const x = margin + (year - minYear) * scale;
        return (
          <g key={year}>
            <line
              x1={x}
              y1={margin / 2}
              x2={x}
              y2={svgHeight - margin / 2}
              stroke="#d1d5db"
              strokeWidth={1}
            />
            <text
              x={x}
              y={svgHeight - margin / 4}
              fontSize={12}
              fill="#6b7280"
              textAnchor="middle"
            >
              {formatYear(year)}
            </text>
          </g>
        );
      })}

      {/* Метки философов */}
      {philosophers.map((philosopher) => {
        return <TimelineItem key={philosopher.name} timeline={philosopher} />;
      })}
      {/* Метки начала и конца шкалы */}
      {/* <div className="absolute left-0 -bottom-6 text-xs text-gray-500 dark:text-gray-400">
          {formatYear(minYear)}
        </div>
        <div className="absolute right-0 -bottom-6 text-xs text-gray-500 dark:text-gray-400">
          {formatYear(maxYear)}
        </div> */}
    </svg>
  );
};

const TimelineItem: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const x = margin + (timeline.from - minYear) * scale;
  const width = (timeline.to - timeline.from) * scale;
  // const y =
  //   svgHeight / 2 + (timeline.level - philosophers.length / 2) * laneHeight;
  return (
    <g>
      <rect
        x={x}
        y1={svgHeight / 2}
        // y={y - 10}
        width={width}
        height={10}
        fill="#6366f1"
        opacity={0.8}
        rx={6}
      />
      <text
        x={x + width / 2}
        // y={y - 18}
        y1={svgHeight / 2 - 10}
        fontSize={14}
        fill="#1e293b"
        textAnchor="middle"
        fontWeight="bold"
      >
        {timeline.name}
      </text>
      <text
        x={x + width / 2}
        // y={y + 22}
        y1={svgHeight / 2 + 10}
        fontSize={11}
        fill="#374151"
        textAnchor="middle"
      >
        {formatYear(timeline.from)} — {formatYear(timeline.to)}
      </text>
    </g>
  );
};
