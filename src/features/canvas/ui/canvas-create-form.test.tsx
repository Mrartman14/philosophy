// src/features/canvas/ui/canvas-create-form.test.tsx
import "@testing-library/jest-dom/vitest";
import { Toast as BaseToast } from "@base-ui/react/toast";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Server action не вызываем в этом контракт-тесте — стаб, чтобы import не тянул "use server".
vi.mock("../actions", () => ({ createCanvas: vi.fn() }));

// useActionState: identity на initial-state, action-stub.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: (_action: unknown, initial: unknown) => [initial, vi.fn()],
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));

import { CanvasCreateForm } from "./canvas-create-form";

function Wrapper({ children }: { children: ReactNode }) {
  return <BaseToast.Provider>{children}</BaseToast.Provider>;
}

afterEach(cleanup);

describe("CanvasCreateForm — серверная Zod-валидация (не нативный required)", () => {
  it("title-контрол несёт aria-required, но НЕ нативный required", () => {
    render(
      <Wrapper>
        <CanvasCreateForm />
      </Wrapper>,
    );

    // Лейбл несёт звёздочку-* required → ищем по подстроке (exact: false).
    const titleInput = screen.getByLabelText("createForm.titleLabel", {
      exact: false,
    });
    expect(titleInput).toHaveAttribute("aria-required", "true");
    // НЕ нативный `required`: jest-dom `toBeRequired()` ARIA-aware (считает
    // aria-required="true" обязательным), поэтому проверяем именно отсутствие
    // нативного HTML-атрибута — это и есть контракт (Base UI не режет сабмит).
    expect(titleInput).not.toHaveAttribute("required");
    expect((titleInput as HTMLInputElement).required).toBe(false);
  });
});
