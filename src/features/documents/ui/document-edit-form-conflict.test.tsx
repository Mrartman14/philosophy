// src/features/documents/ui/document-edit-form-conflict.test.tsx
// Интеграционный тест merge-оркестрации формы документа: conflict-результат
// поднимает <AstMergeView>, apply доводит блоки в редактор и переводит hidden
// version на свежую серверную; gone-результат показывает сообщение об удалении.
//
// jest-dom matchers (toHaveValue / toBeInTheDocument) подключаются пофайлово —
// глобального setup в проекте нет.
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

const updateDocumentBlocks = vi.hoisted(() => vi.fn());

vi.mock("../actions", () => ({ updateDocumentBlocks }));
vi.mock("@/components/ast-editor/lazy-ast-editor", () => ({
  LazyAstEditor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/ast-merge", () => ({
  AstMergeView: ({ onApply }: { onApply: (b: AstBlock[]) => void }) => (
    <div data-testid="merge-view">
      <button
        onClick={() => {
          onApply([{ id: "a", type: "paragraph", text: "merged" }]);
        }}
      >
        apply
      </button>
    </div>
  ),
}));
vi.mock("@/components/ui", () => ({
  Form: ({ action, children }: { action: (fd: FormData) => void; children: ReactNode }) => (
    <form action={action as never}>{children}</form>
  ),
  FormField: ({ children }: { children: ReactNode }) => <>{children}</>,
  IdempotencyField: () => null,
  SubmitButton: ({ children }: { children: ReactNode }) => (
    <button type="submit">{children}</button>
  ),
}));
vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));

import { DocumentEditForm } from "./document-edit-form";

const doc = { id: "d1", version: 5, blocks: [{ id: "a", type: "paragraph", text: "base" }] };

// Скрытые input[name=...] и сам <form> не имеют доступной (accessible) проекции,
// поэтому RTL user-centric-запросы к ним неприменимы — точечно читаем DOM.
/* eslint-disable testing-library/no-node-access */
function versionInput(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector('input[name="version"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error('hidden version input not found');
  }
  return el;
}

function formEl(container: HTMLElement): HTMLFormElement {
  const el = container.querySelector("form");
  if (!(el instanceof HTMLFormElement)) {
    throw new Error('form not found');
  }
  return el;
}
/* eslint-enable testing-library/no-node-access */

afterEach(() => {
  cleanup();
  updateDocumentBlocks.mockReset();
});

describe("DocumentEditForm — конфликт версий", () => {
  it("conflict-результат показывает merge-вью; apply обновляет hidden version", async () => {
    updateDocumentBlocks.mockResolvedValue({
      success: true,
      data: {
        kind: "conflict",
        theirs: { blocks: [{ id: "a", type: "paragraph", text: "server" }], version: 8 },
      },
    });

    const { container } = render(<DocumentEditForm document={doc as never} />);
    expect(versionInput(container)).toHaveValue("5");

    fireEvent.submit(formEl(container));

    await waitFor(() => {
      expect(screen.getByTestId("merge-view")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("apply"));

    await waitFor(() => {
      expect(screen.queryByTestId("merge-view")).not.toBeInTheDocument();
    });
    // версия обновлена на свежую серверную (8) для следующего сохранения
    expect(versionInput(container)).toHaveValue("8");
  });

  it("gone-результат показывает сообщение об удалении", async () => {
    updateDocumentBlocks.mockResolvedValue({
      success: true,
      data: { kind: "gone" },
    });
    const { container } = render(<DocumentEditForm document={doc as never} />);
    fireEvent.submit(formEl(container));
    await waitFor(() => {
      expect(screen.getByText("merge.goneMessage")).toBeInTheDocument();
    });
  });
});
