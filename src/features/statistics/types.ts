// src/features/statistics/types.ts
import type { components } from "@/api/schema";

/** GET /api/me/production. Бэк: internal/productionstats */
export type Inventory = components["schemas"]["productionstats.Inventory"];
export type EntityInventory =
  components["schemas"]["productionstats.EntityInventory"];

/** GET /api/me/history/stats. Бэк: internal/history.
 *  Имя с суффиксом Data, чтобы не коллизировать с компонентом `ViewStats`. */
export type ViewStatsData = components["schemas"]["history.Stats"];
export type ViewStatItem = components["schemas"]["history.StatItem"];

/** GET/PUT /api/me/history/settings. */
export type HistorySettings = components["schemas"]["history.Settings"];
