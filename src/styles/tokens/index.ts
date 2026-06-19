import { TYPE_SCALE, RADIUS, SHADOW, Z, DURATION, DENSITY, FONT_STACKS, TEXT_SCALE } from "./scales";
import { COLOR_LAYERS } from "./semantic";

export const TOKENS = {
  colorLayers: COLOR_LAYERS,
  scales: { TYPE_SCALE, RADIUS, SHADOW, Z, DURATION, DENSITY, FONT_STACKS, TEXT_SCALE },
} as const;

export type { ColorTokenName } from "./apca-targets";
export { CONTRAST_PAIRS } from "./apca-targets";
