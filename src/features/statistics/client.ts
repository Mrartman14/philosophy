// src/features/_template/client.ts
// Публичный CLIENT-safe entry слайса — для импорта из "use client"-кода (напр. офлайн-view).
// Только изоморфные/client view, чистые утилиты, типы. ЗАПРЕЩЕНО реэкспортировать
// ./api / ./actions / ./permissions / ./schemas (server-only) и cross-feature — форсит Guardrail 4.
// server-данные/интерактив client-view получают пропами/слотами (паттерн CommentNodeView).

// Раскомментируй при появлении первого client-видимого экспорта:
// export { EntityCardView } from "./ui/entity-card-view";
// export type { Entity } from "./types";

// Пустой re-export держит файл валидным TS-модулем до первого реального экспорта.
export {};
