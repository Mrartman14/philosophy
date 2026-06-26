// src/components/anchor-engine/connector-layer.test.tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectorLayer } from "./connector-layer";

function stubMatch(matches: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

function rect(o: Partial<DOMRect>): DOMRect {
  return {
    top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- DOMRect.toJSON стаб, не используется
    toJSON() {}, ...o,
  } as DOMRect;
}

function makeRoot(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-ast-root", "");
  root.getBoundingClientRect = () => rect({ left: 0, right: 700, top: 0, bottom: 1000, width: 700, height: 1000 });
  document.body.appendChild(root);
  return root;
}

function addCard(id: string) {
  const w = document.createElement("div");
  w.setAttribute("data-note-card-wrapper", id);
  w.getBoundingClientRect = () => rect({ left: 760, right: 920, top: 40, bottom: 120, width: 160, height: 80 });
  document.body.appendChild(w);
}

function addCardWith(id: string, r: Partial<DOMRect>) {
  const w = document.createElement("div");
  w.setAttribute("data-note-card-wrapper", id);
  w.getBoundingClientRect = () => rect({ left: 760, right: 920, width: 160, ...r });
  document.body.appendChild(w);
}

function pathYs(id: string): number[] {
  // eslint-disable-next-line testing-library/no-node-access -- декоративный SVG-оверлей без роли (прецедент: margin-notes-column.test.tsx)
  const d = document.querySelector(`[data-connector="${id}"]`)?.getAttribute("d") ?? "";
  return [...d.matchAll(/[ML] \S+ (\S+)/g)].map((m) => Number(m[1]));
}

const anchorRect = () => rect({ left: 100, right: 300, top: 50, bottom: 70, width: 200, height: 20 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ConnectorLayer", () => {
  it("на wide рисует по одному path на заметку с якорем и карточкой", () => {
    stubMatch(true);
    const root = makeRoot();
    addCard("a");
    addCard("b");
    render(
      <ConnectorLayer
        ids={["a", "b"]}
        getAnchorRect={anchorRect}
        astRootRef={{ current: root }}
        activeId={null}
        tone="annotation"
        recomputeKey={0}
      />,
    );
    // eslint-disable-next-line testing-library/no-node-access -- декоративный SVG-оверлей без роли (прецедент: margin-notes-column.test.tsx)
    expect(document.querySelectorAll("svg path").length).toBe(2);
  });

  it("пропускает заметку без DOM-карточки", () => {
    stubMatch(true);
    const root = makeRoot();
    addCard("a"); // для "b" карточки нет
    render(
      <ConnectorLayer
        ids={["a", "b"]}
        getAnchorRect={anchorRect}
        astRootRef={{ current: root }}
        activeId={null}
        tone="annotation"
        recomputeKey={0}
      />,
    );
    // eslint-disable-next-line testing-library/no-node-access -- декоративный SVG-оверлей без роли (прецедент: margin-notes-column.test.tsx)
    expect(document.querySelectorAll("svg path").length).toBe(1);
  });

  it("на narrow (не wide) ничего не рисует", () => {
    stubMatch(false);
    const root = makeRoot();
    addCard("a");
    render(
      <ConnectorLayer
        ids={["a"]}
        getAnchorRect={anchorRect}
        astRootRef={{ current: root }}
        activeId={null}
        tone="annotation"
        recomputeKey={0}
      />,
    );
    // eslint-disable-next-line testing-library/no-node-access -- декоративный SVG-оверлей без роли (прецедент: margin-notes-column.test.tsx)
    expect(document.querySelector("svg")).toBeNull();
  });

  it("activeId акцентирует свою линию и гасит остальные", () => {
    stubMatch(true);
    const root = makeRoot();
    addCard("a");
    addCard("b");
    render(
      <ConnectorLayer
        ids={["a", "b"]}
        getAnchorRect={anchorRect}
        astRootRef={{ current: root }}
        activeId="a"
        tone="annotation"
        recomputeKey={0}
      />,
    );
    // eslint-disable-next-line testing-library/no-node-access -- декоративный SVG-оверлей без роли (прецедент: margin-notes-column.test.tsx)
    const a = document.querySelector('[data-connector="a"]');
    // eslint-disable-next-line testing-library/no-node-access -- декоративный SVG-оверлей без роли (прецедент: margin-notes-column.test.tsx)
    const b = document.querySelector('[data-connector="b"]');
    expect(a?.getAttribute("stroke-opacity")).toBe("1");
    expect(a?.getAttribute("stroke-width")).toBe("2");
    expect(b?.getAttribute("stroke-opacity")).toBe("0.25");
  });

  it("карточка напротив якоря → строго горизонтальная линия (без излома)", () => {
    stubMatch(true);
    const root = makeRoot();
    addCard("a"); // span 40..120, якорь y1=60 внутри → крепление на 60 → y2===y1
    render(
      <ConnectorLayer
        ids={["a"]}
        getAnchorRect={anchorRect}
        astRootRef={{ current: root }}
        activeId={null}
        tone="annotation"
        recomputeKey={0}
      />,
    );
    expect(new Set(pathYs("a")).size).toBe(1); // все точки на одной высоте → горизонталь
  });

  it("карточку увело вниз стэкингом → локоть (есть вертикальный сегмент)", () => {
    stubMatch(true);
    const root = makeRoot();
    addCardWith("a", { top: 300, bottom: 380 }); // якорь y1=60 выше карточки → край → локоть
    render(
      <ConnectorLayer
        ids={["a"]}
        getAnchorRect={anchorRect}
        astRootRef={{ current: root }}
        activeId={null}
        tone="annotation"
        recomputeKey={0}
      />,
    );
    expect(new Set(pathYs("a")).size).toBeGreaterThan(1); // разные высоты → локоть
  });
});
