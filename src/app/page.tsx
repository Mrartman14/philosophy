import Link from "next/link";

import { LessonsSlider } from "@/components/lessons-slider/lessons-slider";
import { LastViewedLesson } from "@/components/last-viewed-lesson/last-viewed-lesson";

export default function Home() {
  return (
    <div className="prose dark:prose-invert md:prose-xl w-full max-w-full">
      <h1 className="p-4" style={{ margin: 0 }}>
        Главная
      </h1>
      <section>
        <LastViewedLesson />
      </section>
      <section className="pb-4">
        <h2 className="flex gap-2 px-4 pb-2 border-b border-b-(--border)">
          <Link href="/lectures" className="fancy-link font-bold">
            Все лекции
          </Link>
        </h2>
        <LessonsSlider />
      </section>
    </div>
  );
}
