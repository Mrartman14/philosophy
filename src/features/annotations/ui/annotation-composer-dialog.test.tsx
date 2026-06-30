import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({ createAnnotation: vi.fn() }));
vi.mock("@/components/ast-editor/lazy-ast-editor", () => ({
  LazyAstEditor: () => <div data-testid="editor" />,
}));
vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./annotation-visibility-field", () => ({
  AnnotationVisibilityField: () => null,
}));
vi.mock("@/components/ui", () => ({
  // Dialog рендерит детей всегда (контролируемый open в тесте не важен).
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  createTypedForm: () => ({
    Field: ({ children }: { children: ReactNode }) => <>{children}</>,
    f: (name: string) => name,
    errors: () => ({}),
  }),
  Form: ({ action, children }: { action: (fd: FormData) => void; children: ReactNode }) => (
    <form action={action as never}>{children}</form>
  ),
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FormFeedback: () => null,
  IdempotencyField: () => null,
  SubmitButton: ({ children }: { children: ReactNode }) => <button type="submit">{children}</button>,
}));

import { AnnotationComposerDialog } from "./annotation-composer-dialog";

/* eslint-disable testing-library/no-node-access */
function hiddenInput(container: HTMLElement, name: string): HTMLInputElement | null {
  const el = container.querySelector(`input[name="${name}"]`);
  return el instanceof HTMLInputElement ? el : null;
}
/* eslint-enable testing-library/no-node-access */

afterEach(() => { cleanup(); });

describe("AnnotationComposerDialog — проброс parentEntityType в форму", () => {
  it("кладёт parent_entity_type из пропа в форму (не хардкод document)", () => {
    const { container } = render(
      <AnnotationComposerDialog
        parentEntityType="comment"
        parentId="cmt-42"
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(hiddenInput(container, "parent_entity_type")).toHaveValue("comment");
    expect(hiddenInput(container, "parent_entity_id")).toHaveValue("cmt-42");
  });

  it("по умолчанию (без пропа) — document (старый caller остаётся жив)", () => {
    const { container } = render(
      <AnnotationComposerDialog parentId="doc-1" open onOpenChange={vi.fn()} />,
    );
    expect(hiddenInput(container, "parent_entity_type")).toHaveValue("document");
  });
});
