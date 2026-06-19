import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

import type { Inventory } from "../types";

// Мок @/i18n: getT("statistics") возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n", async () => {
  const { default: statistics } = await import(
    "@/i18n/messages/ru/statistics"
  );
  return {
    getT: (_ns: string) =>
      Promise.resolve((key: string) => {
        const parts = key.split(".");
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = statistics;
        for (const part of parts) {
          val = val?.[part];
        }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        return typeof val === "string" ? val : key;
      }),
  };
});

import { ProductionStatsTable } from "./production-stats-table";

afterEach(cleanup);

const inventory: Inventory = {
  by_type: [
    { entity_type: "lecture", total: 5, public: 3, private: 2 },
    { entity_type: "comment", total: 7 },
  ],
  totals: { total: 12, public: 3, private: 2 },
};

describe("ProductionStatsTable", () => {
  it("рендерит строки с локализованными подписями и итоги", async () => {
    render(await ProductionStatsTable({ inventory }));
    expect(screen.getByText("Лекции")).toBeTruthy();
    expect(screen.getByText("Комментарии")).toBeTruthy();
    expect(screen.getByText("Итого")).toBeTruthy();
  });

  it("для comment показывает «—» в колонках публичных/приватных", async () => {
    render(await ProductionStatsTable({ inventory }));
    // у comment public/private отсутствуют → две ячейки с «—»
    expect(screen.getAllByText("—").length).toBe(2);
  });

  it("пустой инвентарь → EmptyState", async () => {
    render(
      await ProductionStatsTable({
        inventory: { by_type: [], totals: { total: 0, public: 0, private: 0 } },
      }),
    );
    expect(screen.getByText("Вы пока ничего не создали")).toBeTruthy();
  });
});
