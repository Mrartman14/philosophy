import { describe, it, expect } from "vitest";

import { makeFixtureMap } from "./fixtures";

describe("makeFixtureMap", () => {
  it("детерминирован по seed", () => {
    const a = makeFixtureMap({ count: 50, seed: 7 });
    const b = makeFixtureMap({ count: 50, seed: 7 });
    expect(a.points[0]).toEqual(b.points[0]);
    expect(a.points.at(-1)).toEqual(b.points.at(-1));
  });

  it("уважает count и dims=3", () => {
    const m = makeFixtureMap({ count: 123 });
    expect(m.points).toHaveLength(123);
    expect(m.dims).toBe(3);
    const firstPoint = m.points[0];
    if (firstPoint) {
      expect(firstPoint.coords).toHaveLength(3);
    }
  });

  it("все точки внутри возвращённых bounds", () => {
    const m = makeFixtureMap({ count: 500, seed: 3 });
    for (const p of m.points) {
      for (let d = 0; d < 3; d++) {
        const coord = p.coords[d] ?? 0;
        const minBound = m.bounds.min[d] ?? 0;
        const maxBound = m.bounds.max[d] ?? 0;
        expect(coord).toBeGreaterThanOrEqual(minBound);
        expect(coord).toBeLessThanOrEqual(maxBound);
      }
    }
  });

  it("суммы размеров кластеров равны count", () => {
    const m = makeFixtureMap({ count: 200, clusters: 5 });
    const sum = m.clusters.reduce((s, c) => s + (c.size ?? 0), 0);
    expect(sum).toBe(200);
    expect(m.clusters).toHaveLength(5);
  });
});
