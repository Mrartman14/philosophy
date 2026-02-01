"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- КОНСТАНТЫ И НАСТРОЙКИ ---

const TIMELINE_LENGTH = 20;

// Настройки хаоса (в миллисекундах)
const FUTURE_BASE_INTERVAL = 1000; // Базовая скорость мерцания будущего (рядом с наблюдателем)
const PAST_BASE_INTERVAL = 8000; // Базовая стабильность памяти (рядом с наблюдателем)

// Коэффициенты ускорения энтропии от расстояния
// Чем выше число, тем быстрее ускоряется мерцание при удалении от ползунка
const FUTURE_ENTROPY_FACTOR = 100;
const PAST_DECAY_FACTOR = 500;

const REALITY_ICONS = [
  "👶",
  "🍼",
  "🎂",
  "🎈",
  "🎉",
  "🎊",
  "🎓",
  "💼",
  "🧑‍💼",
  "💘",
  "💍",
  "💒",
  "🏠",
  "🚗",
  "✈️",
  "🚆",
  "🧳",
  "🗺️",
  "🤒",
  "🏥",
  "🏃‍♂️",
  "🏋️‍♀️",
  "🧘‍♀️",
  "🍽️",
  "🍻",
  "☕",
  "🎄",
  "🎃",
  "🎆",
  "🎇",
  "🎁",
  "🎮",
  "🎧",
  "🎬",
  "📚",
  "🧑‍🍳",
  "🧹",
  "💻",
  "📱",
];

const getRandomIcon = () =>
  REALITY_ICONS[Math.floor(Math.random() * REALITY_ICONS.length)];

// --- ПОДКОМПОНЕНТЫ ---

// 1. СЛОТ БУДУЩЕГО (FLUX)
// Чем больше distance, тем меньше интервал (чаще мерцание)
const FluxSlot = ({ distance }: { distance: number }) => {
  const [icon, setIcon] = useState(getRandomIcon());

  useEffect(() => {
    // Формула хаоса: Интервал уменьшается с расстоянием.
    // Math.max(50, ...) ставит лимит скорости, чтобы не завис браузер (не чаще 50мс)
    const speed = Math.max(
      50,
      FUTURE_BASE_INTERVAL - distance * FUTURE_ENTROPY_FACTOR,
    );

    const interval = setInterval(() => {
      setIcon(getRandomIcon());
    }, speed);

    return () => clearInterval(interval);
  }, [distance]);

  return (
    <span className="text-2xl opacity-40 blur-[1px] scale-90 transition-all duration-300">
      {icon}
    </span>
  );
};

// 2. СЛОТ ПРОШЛОГО (MEMORY)
// Хранит свое состояние, но иногда "глючит" (меняется) в зависимости от давности
const MemorySlot = ({
  initialIcon,
  distance,
  onCorrupt,
}: {
  initialIcon: string;
  distance: number;
  onCorrupt: (newIcon: string) => void;
}) => {
  // Мы используем useRef для таймера, чтобы перезапускать его при изменении distance

  useEffect(() => {
    // Формула распада: Чем дальше в прошлое, тем чаще подмена.
    const stability = Math.max(
      1000,
      PAST_BASE_INTERVAL - distance * PAST_DECAY_FACTOR,
    );

    const interval = setInterval(() => {
      // С некоторой вероятностью (чтобы не было строго ритмично) меняем иконку
      if (Math.random() > 0.3) {
        onCorrupt(getRandomIcon());
      }
    }, stability);

    return () => clearInterval(interval);
  }, [distance, onCorrupt]);

  return (
    <motion.div
      key={initialIcon} // Анимация при подмене
      initial={{ opacity: 0.5, filter: "blur(2px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 1.5 }}
      className="text-2xl opacity-70 grayscale hover:grayscale-0 transition-all duration-500"
    >
      {initialIcon}
    </motion.div>
  );
};

// --- ОСНОВНОЙ КОМПОНЕНТ ---

export default function PhenomenologyOfTimeSphere() {
  const [presentIndex, setPresentIndex] = useState(10);

  // Хранилище "фактов" прошлого.
  // Мы храним массив целиком, чтобы при перемещении ползунка сохранять историю.
  const [timelineMap, setTimelineMap] = useState<string[]>(
    Array.from({ length: TIMELINE_LENGTH }, () => getRandomIcon()),
  );

  // Обработчик перемещения (Коллапс волновой функции)
  const handleTimeTravel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value);

    if (newIndex > presentIndex) {
      // Движение в будущее: "Фиксируем" пройденные слоты
      setTimelineMap((prev) => {
        const copy = [...prev];
        // Все слоты между старым и новым индексом должны обрести форму
        for (let i = presentIndex; i < newIndex; i++) {
          // Если там еще не было зафиксированного значения (хотя у нас массив предзаполнен), меняем его на новое "открытие"
          copy[i] = getRandomIcon();
        }
        return copy;
      });
    }
    setPresentIndex(newIndex);
  };

  // Функция для обновления конкретного слота памяти (вызывается из MemorySlot)
  const corruptMemory = (index: number, newIcon: string) => {
    setTimelineMap((prev) => {
      const copy = [...prev];
      copy[index] = newIcon;
      return copy;
    });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-200 flex flex-col items-center justify-center p-8 font-sans overflow-hidden">
      {/* Заголовок */}
      <div className="mb-20 text-center space-y-2 select-none">
        <h2 className="text-xs font-bold tracking-[0.5em] text-indigo-500 uppercase glow-text">
          Temporality Engine
        </h2>
        <h1 className="text-4xl md:text-5xl font-thin tracking-wider text-white opacity-90">
          Kantian Manifold
        </h1>
        <p className="text-neutral-600 text-sm max-w-md mx-auto pt-4 leading-relaxed">
          Перетаскивайте сферу. <br />
          Слева — <span className="text-neutral-400">память</span>,
          разлагающаяся со временем.
          <br />
          Справа — <span className="text-neutral-400">будущее</span>, хаотичное
          вдали, но обретающее форму при приближении.
        </p>
      </div>

      {/* Контейнер таймлайна */}
      <div className="relative w-full max-w-5xl h-32 flex items-center justify-center select-none">
        {/* 1. Дорожка слотов */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 z-0">
          {timelineMap.map((fixedIcon, i) => {
            const distance = Math.abs(presentIndex - i);
            const isPast = i < presentIndex;
            const isFuture = i > presentIndex;
            const isPresent = i === presentIndex;

            return (
              <div
                key={i}
                className="relative flex items-center justify-center w-8 h-8 md:w-12 md:h-12"
              >
                {/* ПРОШЛОЕ */}
                {isPast && (
                  <MemorySlot
                    initialIcon={fixedIcon}
                    distance={distance}
                    onCorrupt={(newIcon) => corruptMemory(i, newIcon)}
                  />
                )}

                {/* НАСТОЯЩЕЕ (ПУСТОТА) */}
                {isPresent && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-1 h-1 bg-black rounded-full shadow-[0_0_10px_#000]"
                  />
                )}

                {/* БУДУЩЕЕ */}
                {isFuture && <FluxSlot distance={distance} />}

                {/* Маркер позиции на дорожке */}
                <div
                  className={`absolute -bottom-8 w-px h-3 transition-colors duration-500 ${isPast ? "bg-neutral-800" : "bg-neutral-900"}`}
                />
              </div>
            );
          })}
        </div>

        {/* 2. Инпут (Невидимый контроллер) */}
        <input
          type="range"
          min={0}
          max={TIMELINE_LENGTH - 1}
          value={presentIndex}
          onChange={handleTimeTravel}
          className="absolute inset-0 w-full h-32 opacity-0 z-50 cursor-grab active:cursor-grabbing"
        />

        {/* 3. СФЕРА ВОСПРИЯТИЯ (Визуальный ползунок) */}
        <motion.div
          className="absolute top-1/2 left-0 pointer-events-none z-20"
          // Смещаем на половину ширины трека для центровки
          style={{ x: "-50%", y: "-50%" }}
          animate={{
            left: `${(presentIndex / (TIMELINE_LENGTH - 1)) * 100}%`,
          }}
          transition={{ type: "spring", stiffness: 250, damping: 25 }}
        >
          {/* Шар */}
          <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xs border border-white/10 group">
            {/* Внутреннее свечение/Градиент (Glassmorphism) */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-900/40 opacity-80" />

            {/* Блик */}
            <div className="absolute top-3 left-4 w-6 h-3 bg-white/20 rounded-full blur-[2px] transform -rotate-45" />

            {/* Ядро (Наблюдатель) */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_15px_2px_rgba(255,255,255,0.8)] animate-pulse" />
            </div>

            {/* Эффект линзы (искажение под шаром - имитация) */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" />
          </div>

          {/* Вертикальный луч, указывающий на "Ничто" */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 h-12 w-px bg-gradient-to-b from-indigo-500/50 to-transparent" />
        </motion.div>
      </div>
    </div>
  );
}
