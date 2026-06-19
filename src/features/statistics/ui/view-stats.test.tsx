import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";

// Изолируем юнит: вне Next-runtime рендерим NextLink как <a>, useLinkStatus →
// idle (RouterLinkBusy → null). Конвенция проекта: см. router-link.test.tsx.
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));

import type { ViewStatsData } from "../types";

import { ViewStats } from "./view-stats";

afterEach(cleanup);

describe("ViewStats", () => {
  it("трекинг выключен → подсказка со ссылкой в настройки", () => {
    render(<ViewStats stats={{}} trackingEnabled={false} />);
    expect(screen.getByText("Трекинг просмотров выключен")).toBeTruthy();
    const link = screen.getByRole("link", { name: /настройк/i });
    expect(link.getAttribute("href")).toBe("/me/settings");
  });

  it("трекинг включён, но пусто → соответствующий EmptyState", () => {
    render(<ViewStats stats={{ total: 0, top: [] }} trackingEnabled />);
    expect(screen.getByText("Вы пока ничего не просматривали")).toBeTruthy();
  });

  it("рендерит total, разбивку и топ; доступные цели — ссылки, недоступные — текст", () => {
    const stats: ViewStatsData = {
      total: 5,
      count_by_type: { lecture: 3, document: 1 },
      top: [
        {
          target_type: "lecture",
          target_id: "L1",
          title: "Платон",
          available: true,
          count: 3,
          last_viewed_at: "2026-06-01T10:00:00Z",
        },
        {
          target_type: "trail",
          target_id: "T1",
          available: true,
          count: 1,
          last_viewed_at: "2026-06-02T10:00:00Z",
        },
        {
          target_type: "document",
          target_id: "D9",
          available: false,
          count: 1,
          last_viewed_at: "2026-05-01T10:00:00Z",
        },
      ],
    };
    render(<ViewStats stats={stats} trackingEnabled />);
    // total и разбивка по типам
    expect(screen.getByText(/Всего просмотров/)).toBeTruthy();
    expect(screen.getByText("Лекции: 3")).toBeTruthy();
    // доступная цель с title — ссылка на /lectures/L1
    expect(
      screen.getByRole("link", { name: "Платон" }).getAttribute("href"),
    ).toBe("/lectures/L1");
    // доступная цель без title — фоллбек «Без названия», ссылка на /trails/T1
    expect(
      screen.getByRole("link", { name: "Без названия" }).getAttribute("href"),
    ).toBe("/trails/T1");
    // недоступная цель — текст «Недоступно», без ссылки
    expect(screen.getByText("Недоступно")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /D9/ })).toBeNull();
  });
});
