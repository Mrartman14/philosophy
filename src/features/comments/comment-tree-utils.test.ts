// src/features/comments/comment-tree-utils.test.ts
import { describe, it, expect } from "vitest";

import { groupByParent } from "./comment-tree-utils";
import type { Comment } from "./types";

// Фикстура с ОБЯЗАТЕЛЬНЫМИ полями comment.Comment (created_at/updated_at/lecture_id/id/type)
// — без `as Comment`, иначе tsc даёт TS2352 (overlap) / лишний каст. Если tsc сообщит о
// ещё одном required-поле — добавить его сюда.
function node(id: string, parent_id?: string): Comment {
  return {
    id,
    user_id: "u",
    lecture_id: "l",
    type: "claim",
    blocks: [],
    created_at: "2026-06-14T00:00:00Z",
    updated_at: "2026-06-14T00:00:00Z",
    ...(parent_id ? { parent_id } : {}),
  };
}

describe("groupByParent", () => {
  it("корни группируются под null, дети — под parent_id", () => {
    const map = groupByParent([node("r"), node("a", "r"), node("b", "r")]);
    expect(map.get(null)?.map((n) => n.id)).toEqual(["r"]);
    expect(map.get("r")?.map((n) => n.id)).toEqual(["a", "b"]);
  });
  it("сохраняет порядок вставки детей", () => {
    const map = groupByParent([node("a", "r"), node("b", "r"), node("c", "r")]);
    expect(map.get("r")?.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });
  it("пустой вход → пустая map", () => {
    expect(groupByParent([]).size).toBe(0);
  });
});
