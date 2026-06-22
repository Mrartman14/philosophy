import { describe, it, expect } from "vitest";

import { pickNearestPoint } from "./pick";

// Column-major identity 4x4 — projectToScreen: NDC=world, [0,0,0]→центр экрана.
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const W = 200;
const H = 100;

describe("pickNearestPoint", () => {
  it("точка в центре: клик ровно по ней → её индекс", () => {
    const positions = new Float32Array([0, 0, 0]); // → экранный центр (100,50)
    expect(pickNearestPoint(positions, 1, I, W, H, 100, 50, 8)).toBe(0);
  });

  it("клик дальше порога → -1", () => {
    const positions = new Float32Array([0, 0, 0]); // центр (100,50)
    expect(pickNearestPoint(positions, 1, I, W, H, 140, 50, 8)).toBe(-1);
  });

  it("две точки: берётся ближайшая по пикселям", () => {
    // p0 → (100,50); p1 (x=0.5) → ndcX=0.5 → sx=(0.75)*200=150, sy=50.
    const positions = new Float32Array([0, 0, 0, 0.5, 0, 0]);
    expect(pickNearestPoint(positions, 2, I, W, H, 148, 50, 20)).toBe(1);
    expect(pickNearestPoint(positions, 2, I, W, H, 104, 50, 20)).toBe(0);
  });

  it("невидимая точка (вне куба NDC) игнорируется", () => {
    const positions = new Float32Array([5, 0, 0]); // visible=false
    expect(pickNearestPoint(positions, 1, I, W, H, 100, 50, 1000)).toBe(-1);
  });

  it("пустое облако → -1", () => {
    expect(pickNearestPoint(new Float32Array(0), 0, I, W, H, 100, 50, 8)).toBe(-1);
  });

  it("на границе порога (==threshold) считается попаданием", () => {
    const positions = new Float32Array([0, 0, 0]); // центр (100,50)
    // клик на 8px вправо, threshold 8 → попадание.
    expect(pickNearestPoint(positions, 1, I, W, H, 108, 50, 8)).toBe(0);
  });
});
