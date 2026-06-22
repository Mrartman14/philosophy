import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChevronIcon } from "./chevron-icon";

afterEach(cleanup);

describe("ChevronIcon", () => {
  it("рендерит svg и принимает className (для .rtl-flip)", () => {
    const { container } = render(<ChevronIcon className="rtl-flip" />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- иконка рендерит aria-hidden svg без роли (прецедент: semantic-map-direction.test.tsx)
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("class")).toContain("rtl-flip");
  });

  it("path указывает вправо (inline-end в LTR) — зеркаление пути провалит тест", () => {
    const { container } = render(<ChevronIcon />);
    // Геометрия d определяет направленность стрелки: вершина справа (x=15) при
    // основаниях слева (x=9). Замена на лево-указывающий путь (напр. "M15 6l-6 6 6 6")
    // провалит этот assert — направленность задаёт ИМЕННО d, а флип в RTL — класс .rtl-flip.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- иконка рендерит aria-hidden svg без роли (прецедент: semantic-map-direction.test.tsx)
    const path = container.querySelector("path");
    expect(path?.getAttribute("d")).toBe("M9 6l6 6-6 6");
  });
});
