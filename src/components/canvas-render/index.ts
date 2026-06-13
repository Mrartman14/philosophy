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
export { boundingBox, sidePoint, edgePath } from "./geometry";
