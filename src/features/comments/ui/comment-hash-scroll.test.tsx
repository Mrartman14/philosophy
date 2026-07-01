// src/features/comments/ui/comment-hash-scroll.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommentHashScroll } from "./comment-hash-scroll";

// useReducedMotion завязан на AppearanceProvider-контекст; в юнит-тесте мокаем
// его как чистую функцию (значение фиксировано — motion нас тут не интересует).
// Мокаем ТОЛЬКО reduced-motion, НЕ сам useScrollToCommentThread — проверяем
// реальную связку hash→wait→scroll.
vi.mock("@/components/appearance", () => ({
  useReducedMotion: () => false,
}));

// jsdom не реализует scrollIntoView — подменяем на прототипе стабом, снимаем в
// afterEach. Держим ссылку на стаб отдельно (unbound-method на .scrollIntoView).
let scrollStub: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollStub = vi.fn();
  Element.prototype.scrollIntoView = scrollStub as unknown as Element["scrollIntoView"];
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  window.location.hash = "";
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  vi.restoreAllMocks();
});

describe("CommentHashScroll", () => {
  it("скроллит к узлу, уже присутствующему в DOM при mount", () => {
    const li = document.createElement("li");
    li.id = "comment-x";
    document.body.appendChild(li);
    window.location.hash = "#comment-x";

    render(<CommentHashScroll />);

    expect(scrollStub).toHaveBeenCalledTimes(1);
    expect(scrollStub.mock.instances[0]).toBe(li);
    expect(scrollStub).toHaveBeenCalledWith(
      expect.objectContaining({ block: "center" }),
    );
  });

  it("ждёт появления узла (MutationObserver) и затем скроллит", async () => {
    window.location.hash = "#comment-x";
    render(<CommentHashScroll />);

    // Узла ещё нет — скролла быть не должно.
    expect(scrollStub).not.toHaveBeenCalled();

    // Узел добавляется после mount (эмуляция стрима CommentSection под Suspense).
    const li = document.createElement("li");
    li.id = "comment-x";
    await act(async () => {
      document.body.appendChild(li);
      // MutationObserver отрабатывает микротаском — даём event loop прокрутиться.
      await Promise.resolve();
    });

    expect(scrollStub).toHaveBeenCalledTimes(1);
    expect(scrollStub.mock.instances[0]).toBe(li);
  });

  it("не скроллит при пустом или не-comment хэше", () => {
    window.location.hash = "#somethingelse";
    render(<CommentHashScroll />);

    expect(scrollStub).not.toHaveBeenCalled();
  });

  it("после unmount не скроллит при позднем появлении узла (cleanup наблюдателя)", async () => {
    window.location.hash = "#comment-x";
    const { unmount } = render(<CommentHashScroll />);

    unmount();

    // Узел появляется уже после размонтирования — наблюдатель снят, скролла нет.
    const li = document.createElement("li");
    li.id = "comment-x";
    await act(async () => {
      document.body.appendChild(li);
      await Promise.resolve();
    });

    expect(scrollStub).not.toHaveBeenCalled();
  });
});
