"use client";

import { Slider } from "@/components/shared/slider/slider";
import { LessonCard } from "@/components/lesson/lesson-card";
import { useAppPageConfig } from "@/app/_providers/app-page-client-provider";

export const LessonsSlider: React.FC = () => {
  const { lectures } = useAppPageConfig();

  return (
    <Slider
      trackClassName="pl-4 gap-4"
      itemClassName="shrink-0 grow-0 basis-[200px] md:basis-[300px]"
      items={lectures.map((l) => (
        <LessonCard
          key={l.slug}
          lesson={l}
          className="h-[150px] md:h-[200px]"
        />
      ))}
    />
  );
};
