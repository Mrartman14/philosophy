// src/features/tags/types.ts
import type { components } from "@/api/schema";

/**
 * Тег из бекенда. ВНИМАНИЕ: id — number (int64-автоинкремент), не uuid.
 * id/created_at опциональны в сгенерированной схеме — UI-компоненты
 * гардят `typeof tag.id === "number"` перед действиями (паттерн glossary).
 */
export type Tag = components["schemas"]["tag.Tag"];
