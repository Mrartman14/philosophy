// src/services/observability/context/sw.test.ts
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import type { Runtime } from "../core/types";

describe("SW-телеметрия (отложено)", () => {
  it("контракт Runtime резервирует значение 'sw' для будущего postMessage-моста", () => {
    const sw: Runtime = "sw";
    expect(sw).toBe("sw");
  });

  it("SW-context модуль ещё не реализован (осознанный defer, не забытый half-wire)", () => {
    // Если sw-context появится — этот тест надо обновить вместе с реализацией моста.
    // Проверяем отсутствие файла через fs вместо динамического import(),
    // чтобы избежать статического разрешения пути Vite (модуль намеренно отсутствует).
    const swContextPath = join(import.meta.dirname, "sw.ts");
    expect(existsSync(swContextPath)).toBe(false);
  });
});
