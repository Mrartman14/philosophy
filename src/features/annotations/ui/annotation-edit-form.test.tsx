import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateAnnotation = vi.hoisted(() => vi.fn());

vi.mock("../actions", () => ({ updateAnnotation }));
vi.mock("@/components/ast-editor/lazy-ast-editor", () => ({
  LazyAstEditor: () => <div data-testid="editor" />,
}));
vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));
vi.mock("@/components/ui", () => ({
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
  VersionField: ({ version }: { version: number | undefined }) => (
    <input type="hidden" name="version" value={version ?? ""} readOnly />
  ),
  SubmitButton: ({ children }: { children: ReactNode }) => <button type="submit">{children}</button>,
}));

import { AnnotationEditForm } from "./annotation-edit-form";

const anchor = {
  start_block_id: "p1", end_block_id: "p1", start_char: 6, end_char: 10,
  exact: "bold", prefix: "Hello ", suffix: " world",
};
const annotation = {
  id: "a1", version: 3,
  blocks: [{ id: "b", type: "paragraph", text: "note" }],
  anchor,
};

/* eslint-disable testing-library/no-node-access */
function anchorInput(container: HTMLElement): HTMLInputElement | null {
  const el = container.querySelector('input[name="anchor"]');
  return el instanceof HTMLInputElement ? el : null;
}
/* eslint-enable testing-library/no-node-access */

afterEach(() => { cleanup(); updateAnnotation.mockReset(); });

describe("AnnotationEditForm — сохранение якоря при правке тела", () => {
  it("переотправляет существующий anchor скрытым полем (иначе бэк открепляет аннотацию)", () => {
    const { container } = render(<AnnotationEditForm annotation={annotation as never} />);
    const input = anchorInput(container);
    expect(input).not.toBeNull();
    expect(input).toHaveValue(JSON.stringify(anchor));
  });
});
