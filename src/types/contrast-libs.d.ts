/** Minimal hand-written ambient declarations for untyped colour libraries. */

// ---------------------------------------------------------------------------
// culori — general-purpose colour library (no bundled .d.ts as of v4.x)
// ---------------------------------------------------------------------------
declare module "culori" {
  /** A colour object in any culori colour mode. */
  export interface Color {
    mode: string;
    /** Red channel (0–1) — present in RGB-family modes. */
    r?: number;
    /** Green channel (0–1) — present in RGB-family modes. */
    g?: number;
    /** Blue channel (0–1) — present in RGB-family modes. */
    b?: number;
    /** Lightness — present in Lab/Lch/Oklch-family modes. */
    l?: number;
    /** Chroma — present in Lch/Oklch-family modes. */
    c?: number;
    /** Hue — present in Hsl/Lch/Oklch-family modes. */
    h?: number;
    /** Alpha channel (0–1). */
    alpha?: number;
    [channel: string]: number | string | undefined;
  }

  /**
   * Parse a CSS colour string into a culori Color object.
   * Returns `undefined` when the string is not a recognised colour.
   */
  export function parse(color: string): Color | undefined;

  /**
   * Return a converter function that converts any Color (or CSS string) to
   * the given colour mode.
   */
  export function converter(
    mode: string,
  ): (color: Color | string | undefined) => Color | undefined;

  /**
   * Return a predicate that tests whether a Color is within the gamut of
   * the given colour mode.
   */
  export function inGamut(
    mode: string,
  ): (color: Color | undefined) => boolean;

  /**
   * Serialise a Color (or CSS colour string) to an sRGB hex string.
   * Returns `undefined` when the input is `undefined` / not a valid colour.
   */
  export function formatHex(
    color: Color | string | undefined,
  ): string | undefined;
}

// ---------------------------------------------------------------------------
// apca-w3 — APCA contrast algorithm (no bundled .d.ts)
// ---------------------------------------------------------------------------
declare module "apca-w3" {
  /**
   * Compute the APCA/WCAG3 Lc contrast between foreground and background.
   * `textY` and `bgY` are luminance values in the 0–1 range (as returned by
   * `sRGBtoY`).  The return value is a signed Lc number (positive = light
   * text on dark bg; negative = dark text on light bg).
   */
  export function APCAcontrast(textY: number, bgY: number): number;
  export function APCAcontrast(textY: number, bgY: number, places: number): string;

  /**
   * Convert an sRGB triplet (values 0–255) to relative luminance Y (0–1).
   */
  export function sRGBtoY(rgb: number[]): number;
}

// ---------------------------------------------------------------------------
// apcach — OKLCH colour generation targeting a given APCA contrast ratio
// (no bundled .d.ts)
// ---------------------------------------------------------------------------
declare module "apcach" {
  /** Opaque object returned by `apcach()` and consumed by `apcachToCss()`. */
  export interface ApcachColor {
    readonly alpha: number;
    readonly chroma: number;
    readonly colorSpace: string;
    readonly hue: number;
    readonly lightness: number;
  }

  /** Internal contrast configuration object returned by `crToBg` etc. */
  export interface ContrastConfig {
    readonly cr: number;
    readonly contrastModel: string;
    readonly searchDirection: string;
    readonly bgColor?: string;
    readonly fgColor?: string;
  }

  /**
   * A chroma function returned by `maxChroma()` — consumed by `apcach()`.
   * Opaque: only passed through, never inspected by user code.
   */
  export type MaxChromaFn = (
    config: ContrastConfig,
    hue: number,
    alpha: number,
    colorSpace: string,
  ) => ApcachColor;

  /**
   * Generate an OKLCH colour that achieves `contrast` against a background
   * colour, with the given chroma cap and hue.
   */
  export function apcach(
    contrast: ContrastConfig,
    chroma: number | MaxChromaFn,
    hue: number,
    alpha?: number,
    colorSpace?: string,
  ): ApcachColor;

  /**
   * Serialise an `ApcachColor` to a CSS colour string in the given format
   * (e.g. `"oklch"`, `"rgb"`, `"hex"`).
   */
  export function apcachToCss(color: ApcachColor, format: string): string;

  /**
   * Build a contrast config targeting a specific contrast ratio against a
   * background colour string.
   */
  export function crToBg(
    bgColor: string,
    cr: number,
    contrastModel?: string,
    searchDirection?: string,
  ): ContrastConfig;

  /**
   * Return a `MaxChromaFn` that clamps chroma to `chromaCap` while keeping
   * the colour in gamut.
   */
  export function maxChroma(chromaCap?: number): MaxChromaFn;
}
