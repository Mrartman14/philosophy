// src/features/notifications/notification-content.test.ts
import { describe, expect, it } from "vitest";

import { describeNotification } from "./notification-content";
import type { AppNotification } from "./types";

function make(p: Partial<AppNotification>): AppNotification {
  return {
    id: "n1", type: null, reason: null, actorId: null, actorName: null, targetId: null,
    targetType: null, targetVersion: null, groupCount: 1,
    readAt: null, seenAt: null, createdAt: null, commentLectureId: null, ...p,
  };
}

describe("describeNotification", () => {
  it("document.updated → documentUpdated + count + href", () => {
    const d = describeNotification(make({ type: "document.updated", targetType: "document", targetId: "d1", groupCount: 3 }));
    expect(d).toEqual({ kind: "documentUpdated", count: 3, href: "/documents/d1" });
  });
  it("lecture.updated → lectureUpdated + count + href", () => {
    const d = describeNotification(make({ type: "lecture.updated", targetType: "lecture", targetId: "l1" }));
    expect(d).toEqual({ kind: "lectureUpdated", count: 1, href: "/lectures/l1" });
  });
  it("canvas.updated → canvasUpdated + count + href", () => {
    const d = describeNotification(make({ type: "canvas.updated", targetType: "canvas", targetId: "c1" }));
    expect(d).toEqual({ kind: "canvasUpdated", count: 1, href: "/canvases/c1" });
  });
  it("неизвестный/off-contract тип → kind raw (count, без текста)", () => {
    const d = describeNotification(make({ type: "weird.new" as never, groupCount: 2 }));
    expect(d).toEqual({ kind: "raw", count: 2, href: null });
  });
  it("отсутствующий тип (null) → raw", () => {
    const d = describeNotification(make({ type: null }));
    expect(d).toEqual({ kind: "raw", count: 1, href: null });
  });
  it("нет targetId → href null", () => {
    expect(describeNotification(make({ type: "document.updated", targetType: "document" })).href).toBeNull();
  });
  it("off-contract target_type → href null", () => {
    expect(describeNotification(make({ type: "document.updated", targetType: "media" as never, targetId: "x1" })).href).toBeNull();
  });
  it("comment.replied → commentReplied + deep-link на ответ", () => {
    const d = describeNotification(
      make({ type: "comment.replied", targetType: "comment", targetId: "cmt-9", commentLectureId: "lec-42", groupCount: 2 }),
    );
    expect(d).toEqual({ kind: "commentReplied", count: 2, href: "/lectures/lec-42#comment-cmt-9" });
  });
  it("comment.replied без резолвнутой лекции → href null", () => {
    const d = describeNotification(
      make({ type: "comment.replied", targetType: "comment", targetId: "cmt-9", commentLectureId: null }),
    );
    expect(d).toEqual({ kind: "commentReplied", count: 1, href: null });
  });
});
