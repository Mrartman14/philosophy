import React from "react";

type Philosopher = {
  name: string;
  birth: number;
  death: number;
  level: number;
};
let philosophers: Philosopher[] = [
  { name: "Парменид", birth: -540, death: -470, level: 0 },
  { name: "Гераклит", birth: -544, death: -483, level: 0 },
  { name: "Платон", birth: -427, death: -347, level: 0 },
  { name: "Аристотель", birth: -384, death: -322, level: 0 },
  { name: "Эпикур", birth: -341, death: -270, level: 0 },
];

function assignLevels(p: Philosopher[]) {
  // Клонируем массив, чтобы не мутировать исходные данные
  const sorted = [...p].sort((a, b) => a.birth - b.birth);
  const levels = [];
  const result = [];

  for (const philosopher of sorted) {
    let placed = false;
    for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
      // Проверяем, не пересекается ли с кем-то на этом уровне
      if (
        levels[levelIndex].every(
          (p) => philosopher.birth > p.death || philosopher.death < p.birth
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
  const marks = [];
  // Округляем вниз до ближайшей сотни
  const start = Math.floor(min / step) * step;
  for (let year = start; year <= max; year += step) {
    marks.push(year);
  }
  return marks;
}

philosophers = assignLevels(philosophers);

const scale = 5;
// Определяем минимальный и максимальный год для шкалы
const minYear = Math.min(...philosophers.map((p) => p.birth)) - 10;
const maxYear = Math.max(...philosophers.map((p) => p.death)) + 10;
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
            h-1 bg-gray-300 dark:bg-gray-600 rounded
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
              <div className="h-full w-px bg-gray-400 opacity-40" />
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
          const left = (philosopher.birth - minYear) * scale;
          const width = (philosopher.death - philosopher.birth) * scale;
          const top = `calc(${TIMELINE_HEIGHT}px + ${
            philosopher.level * LEVEL_HEIGHT
          }px + 1rem)`;
          //   const top = `calc(50% + ${
          //     philosopher.level * LEVEL_HEIGHT
          //   }px - 1rem)`;

          return (
            <div
              key={philosopher.name}
              className="absolute"
              style={{ left, width, top }}
            >
              <div
                className="h-2 rounded bg-indigo-500 opacity-70"
                style={{ width }}
                title={`${philosopher.name}: ${formatYear(
                  philosopher.birth
                )} — ${formatYear(philosopher.death)}`}
              />
              <div className="text-md mt-2 text-center" style={{ width }}>
                <span className="font-semibold">{philosopher.name}</span>
                {/* <br />
                <span className="text-gray-500 dark:text-gray-400">
                  {formatYear(philosopher.birth)} —{" "}
                  {formatYear(philosopher.death)}
                </span> */}
              </div>
            </div>
          );
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
