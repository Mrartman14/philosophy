import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { AnchorScopeProvider } from "./anchor-actions";
import type { AnchoredNote } from "./types";
import type { RailScopeEntry } from "./use-rail-scopes";
import { useRailScopes, useRegisterRailScope } from "./use-rail-scopes";

// jsdom: проверяем сам реестр (сбор по тону, регистрация на монтирование,
// фильтр), не визуальный rail. renderNote НЕ вызывается тестом — стабильный
// module-scope noop (анти-инлайн `() => null` в каждом entry).
const noopRender = (_note: AnchoredNote, _orphan: boolean): null => null;

function Register({ entry }: { entry: RailScopeEntry }) {
  useRegisterRailScope(entry);
  return null;
}

function Probe({
  tone,
  onRead,
}: {
  tone: "annotation" | "comment";
  onRead: (n: number) => void;
}) {
  const scopes = useRailScopes(tone);
  useEffect(() => {
    onRead(scopes.length);
  });
  return null;
}

function makeEntry(
  key: string,
  tone: "annotation" | "comment",
): RailScopeEntry {
  return {
    key,
    rootEl: document.createElement("div"),
    tone,
    notes: [],
    renderNote: noopRender,
  };
}

describe("rail scope registry", () => {
  it("collects entries by tone", () => {
    let read = -1;
    const onRead = (n: number) => {
      read = n;
    };
    render(
      <AnchorScopeProvider>
        <Register entry={makeEntry("annotation:comment:c1", "annotation")} />
        <Probe tone="annotation" onRead={onRead} />
      </AnchorScopeProvider>,
    );
    expect(read).toBe(1);
  });

  it("фильтрует по тону: comment-скоупы не попадают в annotation-rail", () => {
    let annotationCount = -1;
    let commentCount = -1;
    const readAnnotation = (n: number) => {
      annotationCount = n;
    };
    const readComment = (n: number) => {
      commentCount = n;
    };
    render(
      <AnchorScopeProvider>
        <Register entry={makeEntry("annotation:document:d1", "annotation")} />
        <Register entry={makeEntry("comment:document:d1", "comment")} />
        <Probe tone="annotation" onRead={readAnnotation} />
        <Probe tone="comment" onRead={readComment} />
      </AnchorScopeProvider>,
    );
    expect(annotationCount).toBe(1);
    expect(commentCount).toBe(1);
  });

  it("реестр идемпотентен по key: повторная регистрация заменяет, не дублирует", () => {
    let count = -1;
    const onRead = (n: number) => {
      count = n;
    };
    const { rerender } = render(
      <AnchorScopeProvider>
        <Register entry={makeEntry("annotation:document:d1", "annotation")} />
        <Probe tone="annotation" onRead={onRead} />
      </AnchorScopeProvider>,
    );
    // тот же key, новый объект entry (как при смене notes/rootEl)
    rerender(
      <AnchorScopeProvider>
        <Register entry={makeEntry("annotation:document:d1", "annotation")} />
        <Probe tone="annotation" onRead={onRead} />
      </AnchorScopeProvider>,
    );
    expect(count).toBe(1);
  });

  it("снимает регистрацию при размонтировании", () => {
    let count = -1;
    const onRead = (n: number) => {
      count = n;
    };
    const { rerender } = render(
      <AnchorScopeProvider>
        <Register entry={makeEntry("annotation:document:d1", "annotation")} />
        <Probe tone="annotation" onRead={onRead} />
      </AnchorScopeProvider>,
    );
    expect(count).toBe(1);
    rerender(
      <AnchorScopeProvider>
        <Probe tone="annotation" onRead={onRead} />
      </AnchorScopeProvider>,
    );
    expect(count).toBe(0);
  });

  it("useRegisterRailScope без провайдера — no-op, не бросает", () => {
    expect(() => {
      render(<Register entry={makeEntry("annotation:document:d1", "annotation")} />);
    }).not.toThrow();
  });
});
