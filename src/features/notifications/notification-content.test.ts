// src/features/notifications/notification-content.test.ts
import { describe, expect, it } from "vitest";

import { renderNotification } from "./notification-content";
import type { AppNotification } from "./types";

function make(p: Partial<AppNotification>): AppNotification {
  return {
    id: "n1", type: "", reason: "", actorId: null, targetId: null,
    targetType: null, targetVersion: null, groupCount: 1,
    readAt: null, seenAt: null, createdAt: null, ...p,
  };
}

describe("renderNotification", () => {
  it("известный тип → шаблонный текст", () => {
    expect(renderNotification(make({ type: "document.updated" })).text).toBe(
      "Документ, на который вы подписаны, обновлён",
    );
  });
  it("ссылка по target_type=document", () => {
    expect(
      renderNotification(make({ type: "document.updated", targetType: "document", targetId: "d1" })).href,
    ).toBe("/documents/d1");
  });
  it("неизвестный тип → fallback на reason", () => {
    expect(renderNotification(make({ type: "weird.new", reason: "Что-то произошло" })).text).toBe(
      "Что-то произошло",
    );
  });
  it("неизвестный тип без reason → нейтральный текст", () => {
    expect(renderNotification(make({ type: "x" })).text).toBe("Новое уведомление");
  });
  it("группировка comment.created", () => {
    expect(renderNotification(make({ type: "comment.created", groupCount: 3 })).text).toBe(
      "Новые комментарии (3)",
    );
  });
  it("неизвестный тип с группой → суффикс (N)", () => {
    expect(renderNotification(make({ type: "x", reason: "Событие", groupCount: 2 })).text).toBe(
      "Событие (2)",
    );
  });
  it("нет targetId → href null", () => {
    expect(renderNotification(make({ type: "document.updated", targetType: "document" })).href).toBeNull();
  });
  it("comment.created с groupCount=1 → единственное число", () => {
    expect(renderNotification(make({ type: "comment.created" })).text).toBe("Новый комментарий");
  });
  it("ссылка по target_type=lecture", () => {
    expect(
      renderNotification(make({ type: "document.updated", targetType: "lecture", targetId: "l1" })).href,
    ).toBe("/lectures/l1");
  });
  it("ссылка по target_type=annotation игнорирует targetId", () => {
    expect(
      renderNotification(make({ type: "document.updated", targetType: "annotation", targetId: "a1" })).href,
    ).toBe("/me/annotations");
  });
  it("неизвестный target_type → href null", () => {
    expect(
      renderNotification(make({ type: "document.updated", targetType: "comment", targetId: "c1" })).href,
    ).toBeNull();
  });
});
