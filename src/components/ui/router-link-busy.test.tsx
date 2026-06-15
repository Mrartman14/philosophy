// src/components/ui/router-link-busy.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const { mockUseLinkStatus } = vi.hoisted(() => ({
  mockUseLinkStatus: vi.fn(() => ({ pending: false })),
}));
vi.mock("next/link", () => ({ useLinkStatus: () => mockUseLinkStatus() }));

import { RouterLinkBusy } from "./router-link-busy";

afterEach(cleanup);

describe("RouterLinkBusy", () => {
  it("pending → рендерит маркер [data-link-pending]", () => {
    mockUseLinkStatus.mockReturnValue({ pending: true });
    render(<RouterLinkBusy />);
    // Маркер намеренно скрыт из a11y-дерева (CSS-хук для :has) — читаем DOM напрямую.
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector("[data-link-pending]")).toBeInTheDocument();
  });

  it("не pending → ничего не рендерит", () => {
    mockUseLinkStatus.mockReturnValue({ pending: false });
    render(<RouterLinkBusy />);
    // Маркер намеренно скрыт из a11y-дерева (CSS-хук для :has) — читаем DOM напрямую.
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector("[data-link-pending]")).toBeNull();
  });
});
