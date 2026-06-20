import "server-only";

import { z } from "zod";

import type { MapData } from "./types";

// .passthrough() — additive-толерантность: незнакомые поля не валят парс.
const ClusterSchema = z
  .object({
    id: z.number(),
    label: z.string().optional(),
    color: z.string().optional(),
    size: z.number().optional(),
  })
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  .passthrough();

const PointSchema = z
  .object({
    type: z.string(), // не enum — неизвестный тип легитимен
    id: z.string(),
    coords: z.array(z.number()),
    cluster: z.number(),
  })
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  .passthrough();

const MapResponseSchema = z
  .object({
    layout_version: z.number(),
    dims: z.number(),
    bounds: z.object({ min: z.array(z.number()), max: z.array(z.number()) })
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      .passthrough(),
    clusters: z.array(ClusterSchema),
    points: z.array(PointSchema),
  })
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  .passthrough();

/** Защитный парс ответа /api/map. Бросает ZodError на структурно битом теле. */
export function parseMapResponse(raw: unknown): MapData {
  return MapResponseSchema.parse(raw) as MapData;
}
