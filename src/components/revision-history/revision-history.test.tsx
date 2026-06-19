// src/components/revision-history/revision-history.test.tsx
import { render, screen, cleanup } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

// Мок @/i18n: getT возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n", async () => {
  const { default: common } = await import("@/i18n/messages/ru/common");
  return {
    getT: (_ns: string) =>
      Promise.resolve((key: string) => {
        const parts = key.split(".");
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = common;
        for (const part of parts) val = val?.[part];
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        return typeof val === "string" ? val : key;
      }),
  };
});

import { RevisionHistory } from "./revision-history";
import type { RevisionListItem } from "./types";

afterEach(cleanup);

// next/link вне Next-runtime не нужен — рендерим обычный <a>.
// vi.mock хоистится над импортами, поэтому объявление после них корректно.
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));

const revisions: RevisionListItem[] = [
  { id: "r2", createdAt: "2026-06-10T12:30:00Z" },
  { id: "r1", createdAt: "2026-06-01T08:00:00Z", label: "alice" },
];

const buildHref = (id: string) => `/admin/events/e1/edit?revision=${id}`;

describe("RevisionHistory", () => {
  it("пустой список → emptyText по умолчанию", async () => {
    render(await RevisionHistory({ revisions: [], buildHref }));
    expect(screen.getByText("Ревизий пока нет.")).toBeTruthy();
  });

  it("рендерит ссылки по buildHref в исходном порядке", async () => {
    render(await RevisionHistory({ revisions, buildHref }));
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toBe(
      "/admin/events/e1/edit?revision=r2",
    );
    expect(links[1]?.getAttribute("href")).toBe(
      "/admin/events/e1/edit?revision=r1",
    );
  });

  it("показывает label, если задан", async () => {
    render(await RevisionHistory({ revisions, buildHref }));
    expect(screen.getByText(/alice/)).toBeTruthy();
  });

  it("помечает выбранную ревизию aria-current", async () => {
    render(await RevisionHistory({ revisions, selectedId: "r1", buildHref }));
    const selected = screen
      .getAllByRole("link")
      .find((l) => l.getAttribute("aria-current") === "true");
    expect(selected?.getAttribute("href")).toContain("revision=r1");
  });

  it("children не рендерится без selectedId", async () => {
    render(
      await RevisionHistory({ revisions, buildHref, children: <p>Снапшот</p> }),
    );
    expect(screen.queryByText("Снапшот")).toBeNull();
  });

  it("children рендерится при заданном selectedId", async () => {
    render(
      await RevisionHistory({
        revisions,
        selectedId: "r2",
        buildHref,
        children: <p>Снапшот</p>,
      }),
    );
    expect(screen.getByText("Снапшот")).toBeTruthy();
  });

  it("переопределяет title и emptyText", async () => {
    render(
      await RevisionHistory({
        revisions: [],
        buildHref,
        title: "Версии термина",
        emptyText: "Пусто",
      }),
    );
    expect(screen.getByText("Версии термина")).toBeTruthy();
    expect(screen.getByText("Пусто")).toBeTruthy();
  });
});
