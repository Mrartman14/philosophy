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
});
