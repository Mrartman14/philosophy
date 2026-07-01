// src/features/annotations/ui/annotation-scope-cross-scope.test.tsx
// Регресс финального ревью: одно page-level действие «аннотировать» переживает
// N+1 смонтированных AnnotationScope (документ + каждый комментарий), и выживший
// action может принадлежать ЧУЖОМУ скоупу. Composer ОБЯЗАН взять parentEntityType
// ИЗ ДРАФТА (за выделением), а не из пропа скоупа-владельца. Иначе POST уйдёт на
// неверный per-entity роут (/api/comments/{ID_документа}/annotations).
//
// Детерминированно (без живого getSelection): мокаем движок и перехватываем
// onCreate, который AnnotationCreateAction регистрирует; мокаем композер-диалог,
// чтобы вынести его prop parentEntityType в data-атрибут для ассерта.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnchorDraft } from "@/components/anchor-engine";

import { AnnotationScope } from "./annotation-scope";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

// Перехватываем onCreate из useStableAnchorAction (как в annotation-create-action.test).
// useRegisterRailScope — no-op-стаб: rail в этом тесте не нужен.
let captured: ((d: AnchorDraft) => void) | null = null;
vi.mock("@/components/anchor-engine", () => ({
  useStableAnchorAction: (cfg: { onCreate: (d: AnchorDraft) => void }) => {
    captured = cfg.onCreate;
  },
  // no-op-стаб (rail в этом тесте не нужен); возвращает undefined, как хук.
  useRegisterRailScope: (): void => undefined,
  // wide-гейт: narrow (false) — как jsdom-дефолт до извлечения хука; этот тест про
  // роутинг композера, не про rail-позиционирование.
  useWide: (): boolean => false,
  // AnnotationScope зовёт anchorScopeSelector в rootEl-discovery-эффекте (M3):
  // держим формат-совместимый стаб, чтобы querySelector не бросал (корня всё равно
  // нет в этом DOM-less тесте — rootEl остаётся null, что для роутинга не важно).
  anchorScopeSelector: (type: string, id: string): string =>
    `[data-anchor-scope="${type}:${id}"]`,
}));

// Композер-диалог мокаем: выносим его prop parentEntityType в DOM для ассерта.
vi.mock("./annotation-composer-dialog", () => ({
  AnnotationComposerDialog: ({
    parentEntityType,
    parentId,
    open,
  }: {
    parentEntityType?: string;
    parentId: string;
    open: boolean;
  }) =>
    open ? (
      <div
        data-testid="composer"
        data-parent-entity-type={parentEntityType}
        data-parent-id={parentId}
      />
    ) : null,
}));

afterEach(() => {
  cleanup();
  captured = null;
});

function registeredOnCreate(): (d: AnchorDraft) => void {
  const fn = captured;
  if (!fn) throw new Error("AnnotationCreateAction не зарегистрировал onCreate");
  return fn;
}

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

describe("AnnotationScope cross-scope composer routing", () => {
  it("композер берёт parentEntityType ИЗ ДРАФТА (document), а не из пропа comment-скоупа", () => {
    // Скоуп-владелец выжившего действия — КОММЕНТАРИЙ; выделение — в ДОКУМЕНТЕ.
    render(<AnnotationScope parentEntityType="comment" parentId="cmt-99" notes={[]} canCreate />);

    act(() => {
      registeredOnCreate()(draftIn("document", "doc-7"));
    });

    const composer = screen.getByTestId("composer");
    // На СТАРОМ коде диалог брал бы parentEntityType="comment" (проп скоупа) и
    // parentId="cmt-99" → POST на /api/comments/doc-7/annotations. Теперь — из драфта.
    expect(composer.getAttribute("data-parent-entity-type")).toBe("document");
    expect(composer.getAttribute("data-parent-id")).toBe("doc-7");
  });

  it("composer не открывается, когда скоуп выделения не является parent аннотации", () => {
    render(<AnnotationScope parentEntityType="comment" parentId="cmt-99" notes={[]} canCreate />);

    // "banner" — валидный backend parent, но НЕ из UI-домена (document/glossary/media/comment).
    act(() => {
      registeredOnCreate()(draftIn("banner", "ban-1"));
    });

    expect(screen.queryByTestId("composer")).toBeNull();
  });
});
