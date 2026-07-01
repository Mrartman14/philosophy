import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnchorDraft } from "@/components/anchor-engine";

import { AnnotationSelectionComposer } from "./annotation-selection-composer";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

// jsdom не даёт живого Selection → перехватываем cfg, который компонент
// регистрирует через useStableAnchorAction, и зовём onCreate синтетическим драфтом.
let captured: { onCreate: (d: AnchorDraft) => void } | null = null;
// vi.hoisted: фабрика vi.mock поднимается выше module-scope const (единый идиом
// с соседними тестами — иначе ссылка на spy в фабрике риск TDZ).
const registerSpy = vi.hoisted(() => vi.fn());
vi.mock("@/components/anchor-engine", () => ({
  useStableAnchorAction: (cfg: { onCreate: (d: AnchorDraft) => void }) => {
    registerSpy(cfg);
    captured = cfg;
  },
}));

// Композер-диалог мокаем: выносим props в data-атрибуты + кнопка close дёргает
// onOpenChange(false) — так тестируем и открытие, и путь закрытия.
vi.mock("./annotation-composer-dialog", () => ({
  AnnotationComposerDialog: ({
    parentEntityType,
    parentId,
    open,
    anchor,
    onOpenChange,
  }: {
    parentEntityType?: string;
    parentId: string;
    open: boolean;
    anchor?: { exact?: string };
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div
        data-testid="composer"
        data-parent-entity-type={parentEntityType}
        data-parent-id={parentId}
        data-anchor-exact={anchor?.exact ?? ""}
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

function onCreate(): (d: AnchorDraft) => void {
  if (!captured) throw new Error("AnnotationSelectionComposer не зарегистрировал действие");
  return captured.onCreate;
}

describe("AnnotationSelectionComposer", () => {
  it("регистрирует ровно одно действие через useStableAnchorAction", () => {
    render(<AnnotationSelectionComposer />);
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ id: "annotation" }));
  });

  it("открывает композер с parent/anchor ИЗ ДРАФТА (document)", () => {
    render(<AnnotationSelectionComposer />);
    act(() => {
      onCreate()(draftIn("document", "doc-7"));
    });
    const composer = screen.getByTestId("composer");
    expect(composer.getAttribute("data-parent-entity-type")).toBe("document");
    expect(composer.getAttribute("data-parent-id")).toBe("doc-7");
    expect(composer.getAttribute("data-anchor-exact")).toBe("hello");
  });

  it("маршрутизирует на comment-скоуп из драфта (не из пропа — пропов нет)", () => {
    render(<AnnotationSelectionComposer />);
    act(() => {
      onCreate()(draftIn("comment", "cmt-42"));
    });
    const composer = screen.getByTestId("composer");
    expect(composer.getAttribute("data-parent-entity-type")).toBe("comment");
    expect(composer.getAttribute("data-parent-id")).toBe("cmt-42");
  });

  it("не открывает композер, если скоуп не является UI-parent аннотации", () => {
    render(<AnnotationSelectionComposer />);
    act(() => {
      // "banner" — валидный backend parent, но НЕ из UI-набора PARENT_ENTITY_TYPES.
      onCreate()(draftIn("banner", "ban-1"));
    });
    expect(screen.queryByTestId("composer")).toBeNull();
  });

  it("закрывает композер через onOpenChange(false)", () => {
    render(<AnnotationSelectionComposer />);
    act(() => {
      onCreate()(draftIn("document", "doc-7"));
    });
    expect(screen.getByTestId("composer")).not.toBeNull();
    fireEvent.click(screen.getByTestId("close"));
    expect(screen.queryByTestId("composer")).toBeNull();
  });
});
