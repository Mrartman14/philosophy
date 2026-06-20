// Форма контракта /api/map (philosophy-api .../2026-06-20-semantic-map-frontend-contract.md).
// Когда /api/map появится в @/api/schema — сузить отсюда; пока вручную.

export interface MapBounds {
  min: number[];
  max: number[];
}

export interface MapCluster {
  id: number;
  label?: string;
  color?: string;
  size?: number;
}

export interface MapPoint {
  /** "document" | "glossary" | ...; неизвестный тип рисуем как обычную точку. */
  type: string;
  /** Непрозрачный id точки. */
  id: string;
  /** Длина = dims; 2D берёт [0],[1], 3D добавляет [2]. */
  coords: number[];
  cluster: number;
}

export interface MapData {
  /** Непрозрачная строка-версия раскладки (content-hash, напр. `sha256-…`) — см. контракт. */
  layout_version: string;
  dims: number;
  bounds: MapBounds;
  clusters: MapCluster[];
  points: MapPoint[];
}

// --- Внутренняя форма для рендерера (типизированные массивы, один draw-call) ---

export interface RenderCluster {
  id: number;
  label: string;
  color: string;
  size: number;
  centroid: [number, number, number];
}

export interface RenderModel {
  count: number;
  /** count*3, всегда 3 координаты (z=0 при dims<3). */
  positions: Float32Array;
  /** count*3, RGB 0..1. */
  colors: Float32Array;
  ids: string[];
  /** Индекс в typeTable. */
  typeCodes: Uint8Array;
  typeTable: string[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  clusters: RenderCluster[];
}
