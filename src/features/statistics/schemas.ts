// src/features/statistics/schemas.ts
import "server-only";
import { z } from "zod";

/** Вход server action `setHistoryTracking` — булев флаг трекинга. */
export const HistoryTrackingSchema = z.boolean();
