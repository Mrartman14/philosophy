// src/components/attachments/attachments-panel.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AttachmentsPanel } from "./attachments-panel";
import type { AttachmentItem } from "./types";

afterEach(cleanup);

const items: AttachmentItem[] = [
  { id: "a", label: "Лекция B", sortOrder: 1, entityType: "document" },
  { id: "b", label: "Лекция A", sortOrder: 0, entityType: "document" },
];

describe("AttachmentsPanel", () => {
  it("read-only: показывает элементы по возрастанию sortOrder, без кнопок управления", () => {
    render(<AttachmentsPanel items={items} title="Привязки" />);
    const labels = screen.getAllByTestId("attachment-label").map((n) => n.textContent);
    expect(labels).toEqual(["Лекция A", "Лекция B"]);
    expect(screen.queryByRole("button", { name: /Открепить/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Прикрепить/ })).toBeNull();
  });

  it("пустой список → emptyText", () => {
    render(<AttachmentsPanel items={[]} emptyText="Пусто" />);
    expect(screen.getByText("Пусто")).toBeTruthy();
  });

  it("canManage: рендерит detach и вызывает onDetach", async () => {
    const onDetach = vi.fn().mockResolvedValue({ ok: true });
    render(
      <AttachmentsPanel
        items={items}
        canManage
        onDetach={onDetach}
        onReorder={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /Открепить/ });
    expect(buttons.length).toBe(2);
    fireEvent.click(buttons[0]!);
    await waitFor(() => { expect(onDetach).toHaveBeenCalledTimes(1); });
  });

  it("canManage без canAttach: кнопки «Прикрепить» нет", () => {
    render(
      <AttachmentsPanel
        items={items}
        canManage
        onDetach={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Прикрепить/ })).toBeNull();
  });

  it("canAttach: показывает кнопку «Прикрепить», открывает пикер", () => {
    render(
      <AttachmentsPanel
        items={items}
        canManage
        canAttach
        onDetach={vi.fn()}
        onReorder={vi.fn()}
        onAttach={vi.fn().mockResolvedValue({ ok: true })}
        renderTargetPicker={() => <div data-testid="picker">picker</div>}
      />,
    );
    const attachBtn = screen.getByRole("button", { name: /Прикрепить/ });
    fireEvent.click(attachBtn);
    expect(screen.getByTestId("picker")).toBeTruthy();
  });

  it("detach с ошибкой показывает сообщение", async () => {
    const onDetach = vi.fn().mockResolvedValue({ ok: false, error: "Нельзя открепить" });
    render(
      <AttachmentsPanel items={items} canManage onDetach={onDetach} onReorder={vi.fn()} />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Открепить/ })[0]!);
    await waitFor(() => { expect(screen.getByRole("alert").textContent).toContain("Нельзя открепить"); });
  });
});
