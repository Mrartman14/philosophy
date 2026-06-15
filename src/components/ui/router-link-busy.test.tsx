// src/components/ui/router-link-busy.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const { mockUseLinkStatus } = vi.hoisted(() => ({ mockUseLinkStatus: vi.fn() }));
vi.mock("next/link", () => ({ useLinkStatus: () => mockUseLinkStatus() }));

import { RouterLinkBusy } from "./router-link-busy";

afterEach(cleanup);

describe("RouterLinkBusy", () => {
  it("pending → рендерит маркер [data-link-pending]", () => {
    mockUseLinkStatus.mockReturnValue({ pending: true });
    const { container } = render(<RouterLinkBusy />);
    expect(container.querySelector("[data-link-pending]")).toBeInTheDocument();
  });

  it("не pending → ничего не рендерит", () => {
    mockUseLinkStatus.mockReturnValue({ pending: false });
    const { container } = render(<RouterLinkBusy />);
    expect(container.querySelector("[data-link-pending]")).toBeNull();
  });
});
