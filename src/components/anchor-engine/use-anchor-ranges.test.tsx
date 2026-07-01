import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import type { AnchoredNote } from "./types";
import { useAnchorRanges } from "./use-anchor-ranges";

// Стабильная ссылка на массив notes между ре-рендерами хука: эффект пересчёта
// геометрии держит `notes` в deps и вызывает setRecomputeKey при каждом запуске,
// поэтому новый литерал [] на каждом рендере (через renderHook) гонял бы эффект
// по кругу. Это зеркалит реальную интеграцию (notes приходит стабильным пропом).
const EMPTY: AnchoredNote[] = [];

describe("useAnchorRanges", () => {
  it("ready=false когда rootRef пуст; ranges пуст", () => {
    const ref = createRef<HTMLElement>();
    const { result } = renderHook(() =>
      useAnchorRanges({ astRootRef: ref, notes: EMPTY }),
    );
    expect(result.current.ready).toBe(false);
    expect(result.current.ranges.size).toBe(0);
    expect(result.current.getAnchorRect("x")).toBeNull();
  });

  it("ready=true когда rootRef заполнен", () => {
    const el = document.createElement("div");
    const ref = createRef<HTMLElement>();
    ref.current = el;
    const { result } = renderHook(() =>
      useAnchorRanges({ astRootRef: ref, notes: EMPTY }),
    );
    expect(result.current.ready).toBe(true);
  });

  it("geometries: rect-якорь → kind:rect (ranges.get=null); range-якорь → оба", () => {
    const el = document.createElement("div");
    el.innerHTML =
      '<table data-block-id="t1"><tbody><tr>' +
      '<td data-node-id="c1" id="c1">aa</td><td data-node-id="c2" id="c2">bb</td>' +
      "</tr></tbody></table>" +
      '<p data-block-id="p1" data-node-id="p1">Hello</p>';
    document.body.appendChild(el);
    // eslint-disable-next-line testing-library/no-node-access -- raw-DOM ячейки стабятся getBoundingClientRect для rect-геометрии resolveAnchor (прецедент: connector-layer.test.tsx)
    const c1 = el.querySelector("#c1"),
      // eslint-disable-next-line testing-library/no-node-access -- raw-DOM ячейки стабятся getBoundingClientRect для rect-геометрии resolveAnchor (прецедент: connector-layer.test.tsx)
      c2 = el.querySelector("#c2");
    if (c1) c1.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
    if (c2) c2.getBoundingClientRect = () => new DOMRect(10, 0, 10, 10);
    const ref = createRef<HTMLElement>();
    ref.current = el;
    const notes: AnchoredNote[] = [
      {
        id: "rect1",
        anchor: {
          startBlockId: "t1",
          endBlockId: "t1",
          startNodeId: "c1",
          endNodeId: "c2",
          startChar: 0,
          endChar: 2,
          exact: "aabb",
        },
      },
      {
        id: "lin1",
        anchor: {
          startBlockId: "p1",
          endBlockId: "p1",
          startNodeId: "p1",
          endNodeId: "p1",
          startChar: 1,
          endChar: 4,
          exact: "ell",
        },
      },
    ];
    const { result } = renderHook(() => useAnchorRanges({ astRootRef: ref, notes }));
    expect(result.current.geometries.get("rect1")?.kind).toBe("rect");
    expect(result.current.ranges.get("rect1")).toBeNull();
    expect(result.current.geometries.get("lin1")?.kind).toBe("range");
    expect(result.current.ranges.get("lin1")).not.toBeNull();
  });
});
