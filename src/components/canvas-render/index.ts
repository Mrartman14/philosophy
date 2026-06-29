// src/components/canvas-render/index.ts
// NOTE: CanvasRender (async server component) is NOT re-exported here to avoid
// contaminating client-side module graphs. Import it directly from
// "@/components/canvas-render/canvas-render" in server-only files.
export type {
  CanvasRenderProps,
  RenderData,
  RenderNode,
  RenderEdge,
  Side,
  EntityRefResolver,
  EntityRefView,
  BBox,
} from "./types";
export {
  boundingBox,
  sidePoint,
  edgePath,
  edgeSegment,
  center,
  boxBorderIntersection,
} from "./geometry";
export type { Point, EdgeGeometry } from "./geometry";
export { NodeShapeRender } from "./node-shapes";
export { EdgeShapeRender, ArrowMarkerDefs } from "./edge-shape";
export { CanvasScene, CanvasSceneBody, CANVAS_MARGIN, staticViewBox } from "./canvas-scene";
export type { CanvasSceneProps } from "./canvas-scene";
