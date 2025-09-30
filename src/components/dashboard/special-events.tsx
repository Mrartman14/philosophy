"use client";

import { Firework } from "../shared/firework/firework";

type SpecialEvent = {
  title: string;
  day: number;
  month: number;
  component: React.FC;
};

const allEvents: SpecialEvent[] = [
  // 8 july
  {
    title: "С днём Рождения, Алексей Андреевич! 🥳 🎉",
    day: 8,
    month: 7,
    component: Firework,
  },
  // 30 september
  {
    title: "С днём Рождения, Вячеслав! 🥳 🎂",
    day: 30,
    month: 9,
    component: Firework,
  },
];

export const SpecialEvents: React.FC = () => {
  const now = new Date();

  const todayEvents = allEvents.filter(
    (e) => now.getDate() === e.day && now.getMonth() === e.month - 1
  );

  if (todayEvents.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-3xl font-extrabold pb-2 p-4 border-b border-(--border) underline">
        События
      </h2>
      {todayEvents.map((e) => (
        <div
          key={e.title}
          className="m-4 p-4 rounded-xl border border-(--border)"
        >
          <h3 className="font-semibold text-ellipsis overflow-hidden whitespace-nowrap">
            {e.title}
          </h3>
          <e.component />
        </div>
      ))}
    </section>
  );
};
