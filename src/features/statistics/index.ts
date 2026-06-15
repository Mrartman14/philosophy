// src/features/statistics/index.ts
export { getHistorySettings, getProductionStats, getViewStats } from "./api";
export { setHistoryTracking } from "./actions";
export { canManageOwnHistory } from "./permissions";
export { ProductionStatsTable } from "./ui/production-stats-table";
export { ViewStats } from "./ui/view-stats";
export { HistoryTrackingToggle } from "./ui/history-tracking-toggle";
// Публичные доменные data-типы (по одному на компонент/фетчер). Внутренние
// детали (EntityInventory, ViewStatItem) наружу не экспонируем.
export type { HistorySettings, Inventory, ViewStatsData } from "./types";
