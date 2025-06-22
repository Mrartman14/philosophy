"use client";

import Image from "next/image";
import React, { useState } from "react";

type Timeline = {
  name: string;
  from: number;
  to: number;
  level: number;
  imageSrc?: string;
};
let philosophers: Timeline[] = [
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
const timelineWidth = (maxYear - minYear) * scale;

const maxLevel = Math.max(...philosophers.map((p) => p.level));
const LEVEL_HEIGHT = 60;
const TIMELINE_HEIGHT = 50;
const containerHeight = 500 + maxLevel * LEVEL_HEIGHT;

const centuryMarks = generateCenturyMarks(minYear, maxYear);

// Функция для конвертации года до н.э. в строку
function formatYear(year: number) {
  return `${Math.abs(year)} до н.э.`;
}

export const PhilosophersTimeline: React.FC = () => {
  return (
    <div className="w-3xl mx-auto py-8">
      <div
        className={`
          relative overflow-y-scroll h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center
      `}
        style={{ height: `${containerHeight}px` }}
      >
        {/* Линия времени */}
        <div
          className={`absolute
            h-1 dark:bg-gray-600 rounded
        `}
          style={{
            top: `${TIMELINE_HEIGHT}px`,
            width: `${timelineWidth}px`,
          }}
        />
        {centuryMarks.map((year) => {
          const left = (year - minYear) * scale;
          return (
            <div
              key={year}
              className="absolute"
              style={{ left: `${left}px`, top: 0, height: "100%" }}
            >
              <div className="h-full w-px dark:bg-gray-600" />
              <div
                className={`absolute left-1/2 -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap`}
                style={{ top: TIMELINE_HEIGHT - 20 }}
              >
                {Math.abs(year)} до н.э.
              </div>
            </div>
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
      </div>
    </div>
  );
};

const TimelineItem: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const [hovered, setHovered] = useState(false);

  const left = (timeline.from - minYear) * scale;
  const width = (timeline.to - timeline.from) * scale;
  const top = `${TIMELINE_HEIGHT}px`;
  //   const top = `calc(${TIMELINE_HEIGHT}px + ${
  //     timeline.level * LEVEL_HEIGHT
  //   }px + 1rem)`;

  return (
    <div
      key={timeline.name}
      className={`absolute h-2 ${
        hovered ? "rounded bg-indigo-500 opacity-70" : ""
      }`}
      style={{ left, width, top }}
      title={`${timeline.name}: ${formatYear(timeline.from)} — ${formatYear(
        timeline.to
      )}`}
      onMouseOver={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {timeline.imageSrc && (
        <Image
          src={timeline.imageSrc}
          alt={`${timeline.name} image`}
          width={20}
          height={20}
          className="object-cover w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ borderRadius: "50%" }}
        />
      )}
    </div>
  );
};
