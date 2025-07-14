import { getLessonList } from "@/api/pages-api";

import { Gradient } from "@/components/shared/gradient/gradient";
import { PhilosophersTimeline } from "@/components/timeline/timeline";

export default async function Page() {
  const lessons = await getLessonList();

  return (
    <div>
      <Gradient />
      <PhilosophersTimeline lessons={lessons} />
    </div>
  );
}
