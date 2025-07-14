import { LessonsDashboard } from "@/components/dashboard/lessons-dashboard";

export default function Home() {
  return (
    <div className="w-full flex flex-col gap-6 pb-4">
      <h1 className="text-5xl font-bold p-4" style={{ margin: 0 }}>
        Главная
      </h1>
      <LessonsDashboard />
    </div>
  );
}
