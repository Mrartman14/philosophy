import { LessonsSlider } from "@/components/lessons-slider/lessons-slider";
import { LastViewedLesson } from "@/components/last-viewed-lesson/last-viewed-lesson";

export default function Home() {
  return (
    <div className="prose dark:prose-invert lg:prose-xl p-4 w-full max-w-full">
      <LastViewedLesson />
      <LessonsSlider />
    </div>
  );
}
