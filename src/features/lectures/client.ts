// src/features/lectures/client.ts
// Публичный CLIENT-safe entry слайса lectures: изоморфный рендер заголовка лекции + типы.
// Импортируется "use client"-кодом (офлайн SavedLectureView в app/saved/**).
// ЗАПРЕЩЕНО реэкспортировать ./api / ./actions / ./permissions / ./schemas (server-only) и
// делать cross-feature импорты — форсит Guardrail 4.
export type { LectureHeaderViewProps } from "./ui/lecture-header-view";
export { LectureHeaderView } from "./ui/lecture-header-view";
