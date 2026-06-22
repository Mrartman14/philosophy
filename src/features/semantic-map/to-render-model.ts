// src/features/semantic-map/to-render-model.ts
// Чистая нормализация MapData → RenderModel (типизированные массивы для one-draw-call).
// Здесь живёт вся «контрактная устойчивость»: additive-игнор, нет цвета/bounds/centroid.
import { clusterColor, computeBounds, hexToRgb01 } from "@/components/scene-3d";

import type { MapData, RenderCluster, RenderModel } from "./types";

export function toRenderModel(data: MapData): RenderModel {
  // Все поля контракта optional (semmap.*) — дефолтим; устойчивость к malformed/пустому.
  const dims = data.dims ?? 3;
  const pts = data.points ?? [];
  // semmap-реген: clusters → tree (semmap.TreeNode[]); пока depth-1 (children всегда []),
  // поэтому tree трактуем как плоский список листовых узлов-кластеров.
  const nodes = data.tree ?? [];
  const count = pts.length;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const ids: string[] = [];
  const docs: string[] = [];

  // Цвет узла по его id (TreeNode.id = индекс кластера на текущей глубине).
  const colorByNode = new Map<number, string>();
  for (const n of nodes) {
    const nid = n.id ?? 0;
    colorByNode.set(nid, clusterColor(nid, n.color));
  }

  // Агрегат координат по узлу — фоллбек центроида/размера, если бэк их не прислал.
  const agg = new Map<number, { x: number; y: number; z: number; n: number }>();

  pts.forEach((p, i) => {
    const co = p.coords ?? [];
    const x = co[0] ?? 0;
    const y = co[1] ?? 0;
    const z = dims >= 3 ? co[2] ?? 0 : 0;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // semmap-реген: point.cluster → point.node (id листового узла дерева).
    const node = p.node ?? 0;
    const hex = colorByNode.get(node) ?? clusterColor(node);
    const [r, g, b] = hexToRgb01(hex);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;

    ids[i] = p.id ?? "";
    // point.doc — id родительского документа; ключ матча оверлея поиска (см. RenderModel.docs).
    docs[i] = p.doc ?? "";

    const a = agg.get(node) ?? { x: 0, y: 0, z: 0, n: 0 };
    a.x += x;
    a.y += y;
    a.z += z;
    a.n += 1;
    agg.set(node, a);
  });

  const clusters: RenderCluster[] = nodes.map((n) => {
    const nid = n.id ?? 0;
    const a = agg.get(nid);
    // Бэк теперь шлёт TreeNode.centroid (для размещения подписи); фоллбек — агрегат точек.
    const c = n.centroid;
    const centroid: [number, number, number] =
      c && c.length >= 2 && Number.isFinite(c[0])
        ? [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0]
        : a?.n
          ? [a.x / a.n, a.y / a.n, a.z / a.n]
          : [0, 0, 0];
    return {
      id: nid,
      label: n.label ?? "",
      color: colorByNode.get(nid) ?? clusterColor(nid, n.color),
      size: n.size ?? a?.n ?? 0,
      centroid,
    };
  });

  return { count, positions, colors, ids, docs, bounds: computeBounds(data.bounds, positions, count), clusters };
}
