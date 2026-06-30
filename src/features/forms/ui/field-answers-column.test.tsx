import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

vi.mock("@/i18n", () => ({
  getT: (_ns: string) => Promise.resolve((k: string) => k),
  getServerFmt: () =>
    Promise.resolve({ dateTime: (v: string) => v, number: (n: number) => String(n), relativeTime: () => "" }),
}));

import { FieldAnswersColumn } from "./field-answers-column";

afterEach(cleanup);

const field = { id: "f1", type: "single_choice", options: [{ id: "o1", label: "Да" }, { id: "o2", label: "Нет" }] } as never;

describe("FieldAnswersColumn", () => {
  it("choice: показывает лейбл выбранной опции и автора", async () => {
    const page = { items: [{ submission_id: "s1", submitted_at: "2026-06-29T00:00:00Z", user: { username: "ivan" }, value: { option_id: "o1" } }], total: 1, offset: 0, limit: 20 };
    render(await FieldAnswersColumn({ field, page, formId: "form1", token: undefined }));
    expect(screen.getByText("Да")).toBeTruthy();
    expect(screen.getByText("ivan")).toBeTruthy();
  });
});
