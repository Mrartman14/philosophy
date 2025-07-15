import { LecturesDashboard } from "@/components/dashboard/lectures-dashboard";

export default function Home() {
  return (
    <div className="w-full flex flex-col gap-6 pb-4">
      <h1 className="text-5xl font-black p-4" style={{ margin: 0 }}>
        Главная
      </h1>
      <LecturesDashboard />
    </div>
  );
}
