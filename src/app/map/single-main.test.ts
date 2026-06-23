import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

// Единственный landmark <main> на странице — корневой (layout.tsx). map/graph
// после Task 5 НЕ должны рендерить собственный <main> (были вложенные → <div>).
describe("single <main> landmark", () => {
  for (const page of ["src/app/map/page.tsx", "src/app/graph/page.tsx"]) {
    it(`${page} не содержит <main>`, () => {
      const src = readFileSync(resolve(process.cwd(), page), "utf-8");
      expect(src).not.toMatch(/<main\b/);
    });
  }
});
