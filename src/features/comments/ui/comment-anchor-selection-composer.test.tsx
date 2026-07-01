import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnchorDraft } from "@/components/anchor-engine";

import { CommentAnchorSelectionComposer } from "./comment-anchor-selection-composer";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

let captured: {
  onCreate: (d: AnchorDraft) => void;
  appliesTo?: (t: string) => boolean;
} | null = null;
// vi.hoisted: фабрика vi.mock поднимается выше module-scope const, поэтому spy,
// на который она ссылается, должен быть инициализирован до подъёма (иначе TDZ).
const registerSpy = vi.hoisted(() => vi.fn());
vi.mock("@/components/anchor-engine", () => ({
  useStableAnchorAction: (cfg: {
    onCreate: (d: AnchorDraft) => void;
    appliesTo?: (t: string) => boolean;
  }) => {
    registerSpy(cfg);
    captured = cfg;
  },
}));

vi.mock("./comment-composer-dialog", () => ({
  CommentComposerDialog: ({
    open,
    anchor,
    lectureId,
    onOpenChange,
  }: {
    open: boolean;
    anchor?: { exact?: string; target_entity_id?: string };
    lectureId: string;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div
        data-testid="composer"
        data-lecture-id={lectureId}
        data-anchor-exact={anchor?.exact ?? ""}
        data-target-id={anchor?.target_entity_id ?? ""}
      >
        <button
          type="button"
          data-testid="close"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          close
        </button>
      </div>
    ) : null,
}));

function draftIn(entityType: string, entityId: string): AnchorDraft {
  return {
    anchor: {
      startBlockId: "b1",
      startNodeId: "b1",
      endBlockId: "b1",
      endNodeId: "b1",
      startChar: 0,
      endChar: 5,
      exact: "hello",
    },
    rect: { top: 0, left: 0, width: 0, height: 0 } as DOMRect,
    scope: { entityType, entityId },
  };
}

afterEach(() => {
  cleanup();
  captured = null;
  registerSpy.mockClear();
});

function reg(): { onCreate: (d: AnchorDraft) => void; appliesTo?: (t: string) => boolean } {
  if (!captured) throw new Error("CommentAnchorSelectionComposer не зарегистрировал действие");
  return captured;
}

describe("CommentAnchorSelectionComposer", () => {
  it("регистрирует ровно одно действие comment-anchor", () => {
    render(<CommentAnchorSelectionComposer lectureId="lec-1" rootTypes={[]} />);
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ id: "comment-anchor" }));
  });

  it("применимо к document-скоупу, не применимо к comment-скоупу (v1)", () => {
    render(<CommentAnchorSelectionComposer lectureId="lec-1" rootTypes={[]} />);
    const applies = reg().appliesTo;
    expect(applies?.("document")).toBe(true);
    expect(applies?.("comment")).toBe(false);
  });

  it("открывает композер с anchor из драфта документа", () => {
    render(<CommentAnchorSelectionComposer lectureId="lec-1" rootTypes={[]} />);
    act(() => {
      reg().onCreate(draftIn("document", "doc-7"));
    });
    const composer = screen.getByTestId("composer");
    expect(composer.getAttribute("data-lecture-id")).toBe("lec-1");
    expect(composer.getAttribute("data-anchor-exact")).toBe("hello");
    // Якорь построен из draft.scope.entityId → target_entity_id документа (не lectureId).
    expect(composer.getAttribute("data-target-id")).toBe("doc-7");
  });

  it("закрывает композер через onOpenChange(false)", () => {
    render(<CommentAnchorSelectionComposer lectureId="lec-1" rootTypes={[]} />);
    act(() => {
      reg().onCreate(draftIn("document", "doc-7"));
    });
    expect(screen.getByTestId("composer")).not.toBeNull();
    fireEvent.click(screen.getByTestId("close"));
    expect(screen.queryByTestId("composer")).toBeNull();
  });
});
