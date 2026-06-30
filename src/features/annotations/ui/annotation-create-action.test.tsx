import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AnchorDraft } from "@/components/anchor-engine";

import { AnnotationCreateAction } from "./annotation-create-action";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

// jsdom не даёт реального Selection/getBoundingClientRect → не гоняем живой
// захват через SelectionAffordanceHost. Перехватываем onCreate, который
// AnnotationCreateAction регистрирует через useStableAnchorAction, и зовём его
// напрямую синтетическим AnchorDraft — детерминированный тест маршрутизации.
let captured: ((d: AnchorDraft) => void) | null = null;
vi.mock("@/components/anchor-engine", () => ({
  useStableAnchorAction: (cfg: { onCreate: (d: AnchorDraft) => void }) => {
    captured = cfg.onCreate;
  },
}));

function draftIn(entityType: string, entityId: string): AnchorDraft {
  return {
    anchor: {
      startBlockId: "b1",
      endBlockId: "b1",
      startChar: 0,
      endChar: 5,
      exact: "hello",
    },
    rect: { top: 0, left: 0, width: 0, height: 0 } as DOMRect,
    scope: { entityType, entityId },
  };
}

function registeredOnCreate(): (d: AnchorDraft) => void {
  const fn = captured;
  if (!fn) throw new Error("AnnotationCreateAction не зарегистрировал onCreate");
  return fn;
}

describe("AnnotationCreateAction routing", () => {
  it("открывает композер с parentId/parentEntityType из выбранного скоупа", () => {
    captured = null;
    const onOpen = vi.fn();
    render(<AnnotationCreateAction canCreate onOpenComposer={onOpen} />);

    registeredOnCreate()(draftIn("comment", "cmt-42"));

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ parentEntityType: "comment", parentId: "cmt-42" }),
    );
  });

  it("маршрутизирует на скоуп документа (паритет)", () => {
    captured = null;
    const onOpen = vi.fn();
    render(<AnnotationCreateAction canCreate onOpenComposer={onOpen} />);

    registeredOnCreate()(draftIn("document", "doc-7"));

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ parentEntityType: "document", parentId: "doc-7" }),
    );
  });
});
