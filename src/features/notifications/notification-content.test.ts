// src/features/notifications/notification-content.test.ts
import { describe, expect, it } from "vitest";

import { describeNotification } from "./notification-content";
import type { AppNotification } from "./types";

function make(p: Partial<AppNotification>): AppNotification {
  return {
    id: "n1", type: "", reason: "", actorId: null, targetId: null,
    targetType: null, targetVersion: null, groupCount: 1,
    readAt: null, seenAt: null, createdAt: null, ...p,
  };
}

describe("describeNotification", () => {
  it("известный тип → kind + href", () => {
    const d = describeNotification(make({ type: "document.updated", targetType: "document", targetId: "d1" }));
    expect(d).toEqual({ kind: "documentUpdated", href: "/documents/d1" });
  });
  it("comment.created → kind commentCreated с count", () => {
    const d = describeNotification(make({ type: "comment.created", groupCount: 3 }));
    expect(d).toEqual({ kind: "commentCreated", count: 3, href: null });
  });
  it("неизвестный тип → kind raw (reason + count)", () => {
    const d = describeNotification(make({ type: "weird.new", reason: "Что-то произошло", groupCount: 2 }));
    expect(d).toEqual({ kind: "raw", text: "Что-то произошло", count: 2, href: null });
  });
  it("неизвестный тип без reason → raw c пустым text", () => {
    const d = describeNotification(make({ type: "x" }));
    expect(d).toEqual({ kind: "raw", text: "", count: 1, href: null });
  });
  it("href по target_type=lecture", () => {
    expect(describeNotification(make({ type: "document.updated", targetType: "lecture", targetId: "l1" })).href).toBe("/lectures/l1");
  });
  it("target_type=annotation игнорирует targetId", () => {
    expect(describeNotification(make({ type: "document.updated", targetType: "annotation", targetId: "a1" })).href).toBe("/me/annotations");
  });
  it("нет targetId → href null", () => {
    expect(describeNotification(make({ type: "document.updated", targetType: "document" })).href).toBeNull();
  });
  it("неизвестный target_type → href null", () => {
    expect(describeNotification(make({ type: "document.updated", targetType: "comment", targetId: "c1" })).href).toBeNull();
  });
});
