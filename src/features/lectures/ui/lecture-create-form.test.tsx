// Секция «прикрепить готовые документы» в форме создания лекции (Вариант A):
// видна только при canAttach; скрытое поле attach_document_ids сериализует выбор
// (изначально пустой → "[]"). Взаимодействие с AsyncCombobox здесь не покрываем
// (моки kit/picker) — оркестрацию attach проверяет create-lecture-attach.test.ts.
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  createLecture: vi.fn(),
  searchDocumentsForAttach: vi.fn(),
}));

vi.mock("@/hooks/use-action-redirect", () => ({ useActionRedirect: vi.fn() }));

vi.mock("@/components/attachments", () => ({
  AttachTargetPicker: () => <div data-testid="picker" />,
}));

vi.mock("@/i18n/client", () => ({ useT: () => (key: string) => key }));

vi.mock("@/components/ui", () => ({
  createTypedForm: () => ({
    Field: ({ label, children }: { label: string; children: ReactNode }) => (
      <div>
        <span>{label}</span>
        {children}
      </div>
    ),
    errors: () => ({}),
  }),
  Form: ({ children }: { children: ReactNode }) => <form>{children}</form>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Inline: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FormFeedback: () => null,
  IdempotencyField: () => null,
  IconButton: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  SubmitButton: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  Select: () => <select />,
  TextInput: () => <input />,
  Textarea: () => <textarea />,
}));

import { LectureCreateForm } from "./lecture-create-form";

/* eslint-disable testing-library/no-node-access */
function hiddenAttachInput(container: HTMLElement): HTMLInputElement | null {
  const el = container.querySelector('input[name="attach_document_ids"]');
  return el instanceof HTMLInputElement ? el : null;
}
/* eslint-enable testing-library/no-node-access */

afterEach(() => { cleanup(); });

describe("LectureCreateForm — секция прикрепления документов", () => {
  it("при canAttach=false секции и скрытого поля нет", () => {
    const { container } = render(<LectureCreateForm canAttach={false} />);
    expect(screen.queryByText("attachDocsLabel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("picker")).not.toBeInTheDocument();
    expect(hiddenAttachInput(container)).toBeNull();
  });

  it("при canAttach=true есть секция, пикер и пустое скрытое поле \"[]\"", () => {
    const { container } = render(<LectureCreateForm canAttach />);
    expect(screen.getByText("attachDocsLabel")).toBeInTheDocument();
    expect(screen.getByTestId("picker")).toBeInTheDocument();
    expect(hiddenAttachInput(container)).toHaveValue("[]");
  });
});
