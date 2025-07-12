import Link from "next/link";

import { LessonsSlider } from "@/components/lessons-slider/lessons-slider";
import { LastViewedLesson } from "@/components/last-viewed-lesson/last-viewed-lesson";

export default function Home() {
  return (
    <div className="tractate w-full">
      <h1 className="p-4" style={{ margin: 0 }}>
        Главная
      </h1>
      <section>
        <LastViewedLesson />
      </section>
      <section className="pb-4">
        <Link href="/lectures" className="font-bold">
          <h2 className="flex gap-2 px-4 pb-2 border-b border-b-(--border)">
            <span className="fancy-link">Все лекции</span>
          </h2>
        </Link>
        <LessonsSlider />
      </section>
      {/* <section className="pb-4">
        <h2 className="flex gap-2 px-4 pb-2 border-b border-b-(--border)">
          Видево
        </h2>
        <iframe
          style={{ width: "100%", aspectRatio: "16/9", border: 0 }}
          src="https://www.youtube.com/embed/N3TE4lOay30?si=iS7KMn8rdBZesAIU"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </section> */}
    </div>
  );
}
