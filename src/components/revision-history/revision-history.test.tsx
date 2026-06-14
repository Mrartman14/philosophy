// src/components/revision-history/revision-history.test.tsx
import { render, screen, cleanup } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { RevisionHistory } from "./revision-history";
import type { RevisionListItem } from "./types";

afterEach(cleanup);

// next/link вне Next-runtime не нужен — рендерим обычный <a>.
// vi.mock хоистится над импортами, поэтому объявление после них корректно.
vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));

const revisions: RevisionListItem[] = [
  { id: "r2", createdAt: "2026-06-10T12:30:00Z" },
  { id: "r1", createdAt: "2026-06-01T08:00:00Z", label: "alice" },
];

const buildHref = (id: string) => `/admin/events/e1/edit?revision=${id}`;

describe("RevisionHistory", () => {
  it("пустой список → emptyText по умолчанию", () => {
    render(<RevisionHistory revisions={[]} buildHref={buildHref} />);
    expect(screen.getByText("Ревизий пока нет.")).toBeTruthy();
  });

  it("рендерит ссылки по buildHref в исходном порядке", () => {
    render(<RevisionHistory revisions={revisions} buildHref={buildHref} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toBe(
      "/admin/events/e1/edit?revision=r2",
    );
    expect(links[1]?.getAttribute("href")).toBe(
      "/admin/events/e1/edit?revision=r1",
    );
  });

  it("показывает label, если задан", () => {
    render(<RevisionHistory revisions={revisions} buildHref={buildHref} />);
    expect(screen.getByText(/alice/)).toBeTruthy();
  });

  it("помечает выбранную ревизию aria-current", () => {
    render(
      <RevisionHistory
        revisions={revisions}
        selectedId="r1"
        buildHref={buildHref}
      />,
    );
    const selected = screen
      .getAllByRole("link")
      .find((l) => l.getAttribute("aria-current") === "true");
    expect(selected?.getAttribute("href")).toContain("revision=r1");
  });

  it("рендерит children только при заданном selectedId", () => {
    const { rerender } = render(
      <RevisionHistory revisions={revisions} buildHref={buildHref}>
        <p>Снапшот</p>
      </RevisionHistory>,
    );
    expect(screen.queryByText("Снапшот")).toBeNull();

    rerender(
      <RevisionHistory
        revisions={revisions}
        selectedId="r2"
        buildHref={buildHref}
      >
        <p>Снапшот</p>
      </RevisionHistory>,
    );
    expect(screen.getByText("Снапшот")).toBeTruthy();
  });

  it("переопределяет title и emptyText", () => {
    render(
      <RevisionHistory
        revisions={[]}
        buildHref={buildHref}
        title="Версии термина"
        emptyText="Пусто"
      />,
    );
    expect(screen.getByText("Версии термина")).toBeTruthy();
    expect(screen.getByText("Пусто")).toBeTruthy();
  });
});
