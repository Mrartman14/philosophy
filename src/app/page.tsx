import Link from "next/link";

import { LessonsSlider } from "@/components/lessons-slider/lessons-slider";
import { LastViewedLesson } from "@/components/last-viewed-lesson/last-viewed-lesson";

export default function Home() {
  return (
    <div className="prose dark:prose-invert md:prose-xl w-full max-w-full">
      <section className="p-4">
        <LastViewedLesson />
      </section>
      <section>
        <h2 className="flex gap-2 px-4 pb-2 border-b border-b-(--border)">
          <Link href="/lectures" className="font-bold">
            Все лекции
          </Link>
          →
        </h2>
        <LessonsSlider />
      </section>
    </div>
  );
}
