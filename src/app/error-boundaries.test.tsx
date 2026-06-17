// src/app/error-boundaries.test.tsx
// Render tests for App-Router error boundaries: fallback UI + retry calls reset().
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock Next.js modules used by not-found.tsx (RouterLink → next/link, GoBack →
// next/navigation) so jsdom can mount them without a Next runtime.
// ---------------------------------------------------------------------------
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.PropsWithChildren<{ href: string; [k: string]: unknown }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), refresh: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Import the actual boundary components AFTER mocks are registered.
// (vitest hoists vi.mock() calls, so this order is fine.)
// ---------------------------------------------------------------------------
import RouteError from "@/app/_components/route-error";
import AdminError from "@/app/admin/error";
import RootError from "@/app/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";

afterEach(cleanup);

// Shared stub error used by all error boundaries.
const stubError = new Error("boom") as Error & { digest?: string };

// ---------------------------------------------------------------------------
// RouteError — shared fallback used by scoped segment error.tsx files.
// ---------------------------------------------------------------------------
describe("RouteError (src/app/_components/route-error.tsx)", () => {
  it("renders heading and description", () => {
    const reset = vi.fn();
    render(<RouteError error={stubError} reset={reset} />);
    expect(screen.getByRole("heading", { name: "Что-то пошло не так" })).toBeTruthy();
    expect(screen.getByText("Произошла ошибка при загрузке страницы.")).toBeTruthy();
  });

  it("retry button calls reset()", () => {
    const reset = vi.fn();
    render(<RouteError error={stubError} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Попробовать снова" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Root error.tsx — delegates to the shared RouteError fallback.
// ---------------------------------------------------------------------------
describe("RootError (src/app/error.tsx)", () => {
  it("renders heading and retry button", () => {
    const reset = vi.fn();
    render(<RootError error={stubError} reset={reset} />);
    expect(screen.getByRole("heading", { name: "Что-то пошло не так" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Попробовать снова" })).toBeTruthy();
  });

  it("retry button calls reset()", () => {
    const reset = vi.fn();
    render(<RootError error={stubError} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Попробовать снова" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Admin error.tsx
// ---------------------------------------------------------------------------
describe("AdminError (src/app/admin/error.tsx)", () => {
  it("renders heading and retry button", () => {
    const reset = vi.fn();
    render(<AdminError error={stubError} reset={reset} />);
    expect(screen.getByRole("heading", { name: "Что-то пошло не так" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Попробовать снова" })).toBeTruthy();
  });

  it("retry button calls reset()", () => {
    const reset = vi.fn();
    render(<AdminError error={stubError} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Попробовать снова" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// GlobalError — renders its own <html><body> shell (Next.js convention for
// replacing the entire page on a catastrophic error). jsdom mounts it inside
// its existing <html>/<body>, which produces a React warning about invalid DOM
// nesting — this is expected and benign for a unit test. We still query the
// rendered output successfully via screen.
// ---------------------------------------------------------------------------
describe("GlobalError (src/app/global-error.tsx)", () => {
  it("renders heading and retry button", () => {
    const reset = vi.fn();
    render(<GlobalError error={stubError} reset={reset} />);
    expect(screen.getByRole("heading", { name: "Что-то пошло не так" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });

  it("retry button calls reset()", () => {
    const reset = vi.fn();
    render(<GlobalError error={stubError} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// NotFound — no reset, just renders its message and a home link.
// ---------------------------------------------------------------------------
describe("NotFound (src/app/not-found.tsx)", () => {
  it("renders 'Страница не найдена' heading", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "Страница не найдена" })).toBeTruthy();
  });

  it("renders link back to home", () => {
    render(<NotFound />);
    expect(screen.getByRole("link", { name: "На главную" })).toBeTruthy();
  });
});
