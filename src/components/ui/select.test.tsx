import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Select тянет useT("common") внутри (локализованный placeholder) — мокаем
// client-фасад на реальный ru-каталог, как в соседних обёртках.
vi.mock("@/i18n/client", async () => {
  const common = (await import("@/i18n/messages/ru/common")).default;
  const useT = () => (key: string) =>
    (key.split(".").reduce<unknown>(
      (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
      common,
    ) ?? key) as string;
  return { useT };
});

import { Select } from "./select";

afterEach(cleanup);

const OPTIONS = [
  { value: "a", label: "Алый" },
  { value: "b", label: "Белый" },
];

describe("Select", () => {
  it("по умолчанию (fill) trigger растягивается на ширину родителя (w-full)", () => {
    render(<Select aria-label="цвет" options={OPTIONS} />);
    const trigger = screen.getByRole("combobox", { name: "цвет" });
    expect(trigger).toHaveClass("w-full");
    expect(trigger).not.toHaveClass("w-auto");
  });

  it("fill={false} даёт intrinsic-ширину (w-auto, без w-full)", () => {
    render(<Select fill={false} aria-label="цвет" options={OPTIONS} />);
    const trigger = screen.getByRole("combobox", { name: "цвет" });
    expect(trigger).toHaveClass("w-auto");
    expect(trigger).not.toHaveClass("w-full");
  });
});
