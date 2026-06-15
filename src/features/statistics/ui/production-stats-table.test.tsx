import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

import type { Inventory } from "../types";

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
  it("рендерит строки с локализованными подписями и итоги", () => {
    render(<ProductionStatsTable inventory={inventory} />);
    expect(screen.getByText("Лекции")).toBeTruthy();
    expect(screen.getByText("Комментарии")).toBeTruthy();
    expect(screen.getByText("Итого")).toBeTruthy();
  });

  it("для comment показывает «—» в колонках публичных/приватных", () => {
    render(<ProductionStatsTable inventory={inventory} />);
    // у comment public/private отсутствуют → две ячейки с «—»
    expect(screen.getAllByText("—").length).toBe(2);
  });

  it("пустой инвентарь → EmptyState", () => {
    render(
      <ProductionStatsTable
        inventory={{ by_type: [], totals: { total: 0, public: 0, private: 0 } }}
      />,
    );
    expect(screen.getByText("Вы пока ничего не создали")).toBeTruthy();
  });
});
