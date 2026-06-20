// src/features/search/types.ts
import type { components } from "@/api/schema";

/**
 * Результат POST /api/search — семантический (векторный) поиск по корпусу
 * через embedding-sidecar (бек: llmretrieval). Корпус — ДВА типа источников:
 * document и glossary; лекции/медиа/комментарии в поиск НЕ попадают.
 *
 * Hit плоский: бек отдаёт готовые title/snippet/score/source_url и entity_id
 * для внутренней навигации. Все поля optional — UI граничит отсутствие
 * (рендер "—" / skip хита без ссылки).
 */
export type SearchHit = components["schemas"]["llmretrieval.Hit"];

/** Тип источника результата (бек: `llmretrieval.HitType`). */
export type SearchType = components["schemas"]["llmretrieval.HitType"];
