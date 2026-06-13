// src/components/canvas-render/index.ts
export { CanvasRender } from "./canvas-render";
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
  center,
  boxBorderIntersection,
} from "./geometry";
export type { Point, EdgeGeometry } from "./geometry";
export { NodeShapeRender } from "./node-shapes";
