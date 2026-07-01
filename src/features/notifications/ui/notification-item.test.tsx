import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppNotification } from "../types";

import { NotificationItem } from "./notification-item";

const { pushMock, markReadMock, resolveMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  markReadMock: vi.fn(),
  resolveMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("../actions", () => ({
  markRead: markReadMock,
  resolveCommentReplyHref: resolveMock,
}));
// useT — идентити-стаб: ключ (+params) как строка, тексты тут не проверяем.
vi.mock("@/i18n/client", () => ({
  useT: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

function make(p: Partial<AppNotification>): AppNotification {
  return {
    id: "n1", type: null, reason: null, actorId: null, actorName: null, targetId: null,
    targetType: null, targetVersion: null, groupCount: 1,
    readAt: null, seenAt: null, createdAt: null, ...p,
  };
}

beforeEach(() => {
  pushMock.mockReset();
  markReadMock.mockReset();
  resolveMock.mockReset();
});
afterEach(cleanup);

describe("NotificationItem", () => {
  it("comment.replied: резолвит href по клику (GET по клику) и навигирует", async () => {
    resolveMock.mockResolvedValue({ success: true, data: "/lectures/lec-42#comment-cmt-9" });
    render(
      <NotificationItem
        notification={make({ type: "comment.replied", targetType: "comment", targetId: "cmt-9" })}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => { expect(resolveMock).toHaveBeenCalledWith("cmt-9"); });
    await waitFor(() => { expect(pushMock).toHaveBeenCalledWith("/lectures/lec-42#comment-cmt-9"); });
  });

  it("comment.replied: null-резолв (удалён/ошибка) → без навигации, без краша", async () => {
    resolveMock.mockResolvedValue({ success: true, data: null });
    render(
      <NotificationItem
        notification={make({ type: "comment.replied", targetType: "comment", targetId: "cmt-9" })}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => { expect(resolveMock).toHaveBeenCalledWith("cmt-9"); });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("document.updated: навигирует по статичному href без резолва по клику", async () => {
    render(
      <NotificationItem
        notification={make({ type: "document.updated", targetType: "document", targetId: "d1" })}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => { expect(pushMock).toHaveBeenCalledWith("/documents/d1"); });
    expect(resolveMock).not.toHaveBeenCalled();
  });
});
