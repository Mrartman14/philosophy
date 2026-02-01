"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

// --- КОНСТАНТЫ ---
const TIMELINE_LENGTH = 16;
// Стартовая позиция, которая считается "Истинным Настоящим" при загрузке.
// Всё, что слева от неё — фундаментальная история. Всё, что справа — зыбкое будущее.
const INITIAL_ANCHOR = 6;

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

// --- КОМПОНЕНТЫ ---

// Компонент Хаоса (Мерцание)
const FluxSlot = ({ distance }: { distance: number }) => {
  const [icon, setIcon] = useState(getRandomIcon());

  useEffect(() => {
    // Чем дальше от наблюдателя, тем быстрее хаос
    const speed = Math.max(50, 1000 - distance * 120);
    const interval = setInterval(() => setIcon(getRandomIcon()), speed);
    return () => clearInterval(interval);
  }, [distance]);

  return (
    <motion.span
      key={icon}
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 0.5, filter: "blur(1px)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="text-3xl select-none cursor-default"
    >
      {icon}
    </motion.span>
  );
};

// Компонент Памяти (Стабильность с редким распадом)
const MemorySlot = ({
  icon,
  isSimulated,
}: {
  icon: string;
  isSimulated: boolean;
}) => {
  return (
    <motion.span
      layoutId={`memory-${icon}`} // Помогает плавно морфить при смене типа
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: isSimulated ? 0.8 : 1, // Симулированное будущее чуть прозрачнее
        scale: 1,
        filter: isSimulated ? "sepia(0.5)" : "none", // Визуальный намек на симуляцию
      }}
      className="text-3xl select-none cursor-default"
    >
      {icon}
    </motion.span>
  );
};

// Сфера (Наблюдатель)
const VoidSphere = () => (
  <motion.div
    layoutId="void-sphere"
    className="relative w-10 h-10 flex items-center justify-center z-50 pointer-events-none"
    // transition={{ type: "spring", stiffness: 350, damping: 30 }}
  >
    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/5 to-black/90 backdrop-blur-md shadow-[0_10px_30px_-5px_rgba(0,0,0,1)] border border-white/10" />
    <div className="absolute inset-0 rounded-full shadow-[inset_0_4px_20px_rgba(255,255,255,0.1)]" />
    <div className="relative w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_20px_2px_rgba(99,102,241,0.5)] animate-pulse" />
  </motion.div>
);

// --- ОСНОВНАЯ ЛОГИКА ---

export default function KantianTimeMachine() {
  const [sliderIndex, setSliderIndex] = useState(INITIAL_ANCHOR);

  // "Карта Реальности". Мы храним её всю, но рендерим только стабильные части.
  const [realityMap, setRealityMap] = useState<string[]>(
    Array.from({ length: TIMELINE_LENGTH }, () => getRandomIcon()),
  );

  // Якорь Реальности. Для этой демо-версии он фиксирован,
  // но в игре его можно было бы сдвигать кнопкой "Commit" (Совершить выбор).
  const REALITY_ANCHOR = INITIAL_ANCHOR;

  const handleDrag = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value);

    // ЛОГИКА КОЛЛАПСА ВОЛНЫ
    // Если мы вторгаемся в зону Хаоса (правее Якоря), мы должны сгенерировать
    // для неё временную реальность.
    if (newIndex > REALITY_ANCHOR) {
      setRealityMap((prev) => {
        const next = [...prev];
        // Проходим от старого индекса до нового
        const start = Math.min(sliderIndex, newIndex);
        const end = Math.max(sliderIndex, newIndex);

        for (let i = start; i <= end; i++) {
          // Если мы в зоне будущего (правее якоря), мы "роллим" вероятность.
          // Важно: мы переписываем значение, чтобы каждый новый заход в будущее
          // создавал НОВЫЙ вариант (как ты просил: "will flicker as before/change").
          if (i > REALITY_ANCHOR) {
            next[i] = getRandomIcon();
          }
        }
        return next;
      });
    }

    setSliderIndex(newIndex);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-300 flex flex-col items-center justify-center font-sans overflow-hidden">
      <div className="absolute top-12 text-center opacity-70 px-4">
        <h1 className="text-xl font-light tracking-[0.3em] text-white mb-2">
          TIME MANIFOLD
        </h1>
        <p className="text-xs text-neutral-500 max-w-lg leading-relaxed">
          <span className="text-indigo-400">Anchor Point:</span> Слот{" "}
          {REALITY_ANCHOR + 1}. <br />
          Движение <b>влево</b> — Память (события остаются стабильными). <br />
          Движение <b>вправо</b> — Прогноз (временная фиксация хаоса).
        </p>
      </div>

      <div className="relative w-full max-w-7xl h-64 flex items-center justify-center">
        <LayoutGroup>
          <div className="flex items-center justify-center px-4 w-full gap-1 sm:gap-2">
            {realityMap.map((icon, i) => {
              const isVoid = i === sliderIndex;
              const distance = Math.abs(sliderIndex - i);

              // --- ГЛАВНАЯ ФИЛОСОФСКАЯ ФОРМУЛА ---
              // Событие считается СТАБИЛЬНЫМ (не мерцает), если:
              // 1. Оно уже случилось в Истинной Истории (i <= Anchor)
              // 2. ИЛИ мы сейчас наблюдаем его в процессе Симуляции (i < sliderIndex),
              //    даже если оно правее Якоря.
              const isStable = i <= REALITY_ANCHOR || i < sliderIndex;

              // Является ли это событие "Симуляцией" (воображаемым будущим)?
              // Это нужно для легкого визуального отличия (сепия).
              const isSimulated = i > REALITY_ANCHOR && i < sliderIndex;

              return (
                <motion.div
                  layout
                  key={i}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className={`
                    relative flex flex-col items-center justify-center rounded-lg transition-all duration-300
                    ${isVoid ? "w-24 h-32 z-20" : "w-10 h-16 sm:w-14 sm:h-20 bg-neutral-900/40 border border-white/5"}
                  `}
                >
                  {/* Маркер "Истинного Настоящего" (Якоря) */}
                  {i === REALITY_ANCHOR && !isVoid && (
                    <div className="absolute -top-3 w-1 h-1 bg-white/50 rounded-full shadow-[0_0_10px_white]" />
                  )}

                  <AnimatePresence mode="popLayout">
                    {/* 1. СФЕРА (ПУСТОТА) */}
                    {isVoid && <VoidSphere />}

                    {/* 2. СОДЕРЖИМОЕ СЛОТА */}
                    {!isVoid && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5, filter: "blur(10px)" }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        {isStable ? (
                          <MemorySlot icon={icon} isSimulated={isSimulated} />
                        ) : (
                          <FluxSlot distance={distance} />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Подсветка статуса */}
                  {!isVoid && (
                    <div
                      className={`
                      absolute bottom-1 w-full h-[2px] transition-colors duration-500
                      ${i <= REALITY_ANCHOR ? "bg-neutral-600" : isSimulated ? "bg-indigo-500/50" : "bg-transparent"}
                    `}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </LayoutGroup>

        {/* Слайдер управления */}
        <input
          type="range"
          min={0}
          max={TIMELINE_LENGTH - 1}
          value={sliderIndex}
          onChange={handleDrag}
          className="absolute inset-x-0 h-40 opacity-0 z-50 cursor-ew-resize"
        />
      </div>
    </div>
  );
}
