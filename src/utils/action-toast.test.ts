import { describe, expect, it, vi } from "vitest";

import { toastActionError } from "./action-toast";

function makeToast() {
  return { add: vi.fn() };
}

describe("toastActionError", () => {
  it("shows forbidden toast with branded description", () => {
    const toast = makeToast();
    toastActionError(toast, { success: false, error: "Forbidden", code: "forbidden" }, { action: "удаление лекции" });
    expect(toast.add).toHaveBeenCalledWith({
      title: "Нет прав",
      description: "У вас нет прав на удаление лекции.",
    });
  });

  it("shows error toast for generic error", () => {
    const toast = makeToast();
    toastActionError(toast, { success: false, error: "Server error" }, { action: "удаление" });
    expect(toast.add).toHaveBeenCalledWith({
      title: "Ошибка",
      description: "Server error",
    });
  });

  it("respects custom forbiddenTitle and failureTitle", () => {
    const toast = makeToast();
    toastActionError(
      toast,
      { success: false, error: "Forbidden", code: "forbidden" },
      { action: "публикацию", forbiddenTitle: "Доступ закрыт" },
    );
    expect(toast.add).toHaveBeenCalledWith({
      title: "Доступ закрыт",
      description: "У вас нет прав на публикацию.",
    });
  });
});
