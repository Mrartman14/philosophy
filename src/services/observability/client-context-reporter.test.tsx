import "@testing-library/jest-dom/vitest";
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { setClientActor, setClientRoute } = vi.hoisted(() => ({
  setClientActor: vi.fn(),
  setClientRoute: vi.fn(),
}));
vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return { ...actual, setClientActor, setClientRoute };
});

// usePathname читает мутируемую переменную — позволяет эмулировать клиентскую навигацию.
let pathname = "/lectures";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

import { ClientContextReporter } from "./client-context-reporter";

afterEach(cleanup);
beforeEach(() => {
  setClientActor.mockClear();
  setClientRoute.mockClear();
  pathname = "/lectures";
});

describe("ClientContextReporter", () => {
  it("ставит actor в client-контекст когда передан хеш", () => {
    render(<ClientContextReporter actorHash="h-1" actorRole="user" />);
    expect(setClientActor).toHaveBeenCalledWith("h-1", "user");
  });

  it("не ставит actor для гостя (actorHash=null)", () => {
    render(<ClientContextReporter actorHash={null} actorRole={null} />);
    expect(setClientActor).not.toHaveBeenCalled();
  });

  it("ставит текущий route из usePathname", () => {
    render(<ClientContextReporter actorHash={null} actorRole={null} />);
    expect(setClientRoute).toHaveBeenCalledWith("/lectures");
  });

  it("обновляет route при смене pathname (клиентская навигация)", () => {
    const { rerender } = render(
      <ClientContextReporter actorHash={null} actorRole={null} />,
    );
    setClientRoute.mockClear();
    pathname = "/glossary";
    rerender(<ClientContextReporter actorHash={null} actorRole={null} />);
    expect(setClientRoute).toHaveBeenCalledWith("/glossary");
  });

  it("ничего не рендерит", () => {
    const { container } = render(
      <ClientContextReporter actorHash={null} actorRole={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
