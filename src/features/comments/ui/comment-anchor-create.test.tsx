import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AnchorDraft } from "@/components/anchor-engine";

import { CommentAnchorCreateAction } from "./comment-anchor-scope";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

// jsdom не даёт реального Selection/getBoundingClientRect → не гоняем живой
// захват через SelectionAffordanceHost. Перехватываем cfg, который
// CommentAnchorCreateAction регистрирует через useStableAnchorAction, и зовём
// onCreate напрямую синтетическим AnchorDraft — детерминированный тест
// маршрутизации; appliesTo проверяем как чистый предикат.
let captured: { onCreate: (d: AnchorDraft) => void; appliesTo?: (t: string) => boolean } | null =
  null;
vi.mock("@/components/anchor-engine", () => ({
  useStableAnchorAction: (cfg: {
    onCreate: (d: AnchorDraft) => void;
    appliesTo?: (t: string) => boolean;
  }) => {
    captured = cfg;
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

function registered(): { onCreate: (d: AnchorDraft) => void; appliesTo?: (t: string) => boolean } {
  const cfg = captured;
  if (!cfg) throw new Error("CommentAnchorCreateAction не зарегистрировал действие");
  return cfg;
}

describe("CommentAnchorCreateAction applicability", () => {
  it("применимо к document-скоупу, не применимо к comment-скоупу (v1)", () => {
    captured = null;
    render(<CommentAnchorCreateAction canCreate onOpenComposer={vi.fn()} />);

    const applies = registered().appliesTo;
    expect(applies?.("document")).toBe(true);
    expect(applies?.("comment")).toBe(false);
  });

  it("маршрутизирует на targetDocumentId = scope.entityId документа", () => {
    captured = null;
    const onOpen = vi.fn();
    render(<CommentAnchorCreateAction canCreate onOpenComposer={onOpen} />);

    registered().onCreate(draftIn("document", "doc-7"));

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ targetDocumentId: "doc-7" }),
    );
  });
});
