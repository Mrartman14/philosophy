import Link from "next/link";
import { getLectures } from "@/api/lecture-api";

export default async function Home() {
  const result = await getLectures(1, 100);

  return (
    <div className="w-full flex flex-col gap-6 pb-4">
      <h1 className="text-5xl font-black p-4" style={{ margin: 0 }}>
        Лекции
      </h1>
      <ul className="grid grid-cols-1 gap-2 px-4">
        {result.data.map((lecture) => (
          <li key={lecture.id}>
            <Link
              href={`/lectures/${lecture.id}`}
              className="block p-4 rounded-lg border border-(--border) hover:bg-(--text-pane) transition-colors"
            >
              <h2 className="text-lg font-semibold">{lecture.title}</h2>
              {lecture.description && (
                <p className="text-sm text-(--description) mt-1">
                  {lecture.description}
                </p>
              )}
              {lecture.date && (
                <time className="text-xs text-(--description) mt-2 block">
                  {new Date(lecture.date).toLocaleDateString("ru-RU")}
                </time>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
