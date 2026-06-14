// src/features/comments/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  CommentCreateSchema,
  CommentBlocksUpdateSchema,
  ReactionSchema,
  RemoveReactionSchema,
  CommentIdSchema,
} from "./schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const blocksJson = JSON.stringify([
  { type: "paragraph", content: [{ type: "text", text: "x" }] },
]);

describe("CommentCreateSchema", () => {
  it("принимает корневой claim с blocks", () => {
    const r = CommentCreateSchema.safeParse({
      type: "claim",
      blocks: blocksJson,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.type).toBe("claim");
      expect(Array.isArray(r.data.blocks)).toBe(true);
      expect(r.data.parent_id).toBeUndefined();
    }
  });
  it("принимает ответ с parent_id", () => {
    const r = CommentCreateSchema.safeParse({
      type: "grounds",
      blocks: blocksJson,
      parent_id: UUID,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.parent_id).toBe(UUID);
  });
  it("отклоняет неизвестный тип", () => {
    const r = CommentCreateSchema.safeParse({ type: "bogus", blocks: blocksJson });
    expect(r.success).toBe(false);
  });
  it("отклоняет пустой blocks-массив", () => {
    const r = CommentCreateSchema.safeParse({ type: "claim", blocks: "[]" });
    expect(r.success).toBe(false);
  });
  it("отклоняет битый JSON в blocks", () => {
    const r = CommentCreateSchema.safeParse({ type: "claim", blocks: "{oops" });
    expect(r.success).toBe(false);
  });
  it("отклоняет невалидный parent_id (не uuid)", () => {
    const r = CommentCreateSchema.safeParse({
      type: "claim",
      blocks: blocksJson,
      parent_id: "nope",
    });
    expect(r.success).toBe(false);
  });
});

describe("CommentBlocksUpdateSchema", () => {
  it("принимает id + непустые blocks", () => {
    const r = CommentBlocksUpdateSchema.safeParse({ id: UUID, blocks: blocksJson });
    expect(r.success).toBe(true);
    if (r.success) expect(Array.isArray(r.data.blocks)).toBe(true);
  });
  it("отклоняет пустой массив (BLOCKS_EMPTY на беке)", () => {
    const r = CommentBlocksUpdateSchema.safeParse({ id: UUID, blocks: "[]" });
    expect(r.success).toBe(false);
  });
  it("отклоняет битый uuid", () => {
    const r = CommentBlocksUpdateSchema.safeParse({ id: "x", blocks: blocksJson });
    expect(r.success).toBe(false);
  });
});

describe("ReactionSchema", () => {
  it("принимает agreement +1", () => {
    const r = ReactionSchema.safeParse({ id: UUID, axis: "agreement", value: "1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.value).toBe(1);
  });
  it("принимает quality -1", () => {
    const r = ReactionSchema.safeParse({ id: UUID, axis: "quality", value: "-1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.value).toBe(-1);
  });
  it("отклоняет insight -1 (бек: INVALID_INSIGHT_VALUE)", () => {
    const r = ReactionSchema.safeParse({ id: UUID, axis: "insight", value: "-1" });
    expect(r.success).toBe(false);
  });
  it("отклоняет неизвестную ось", () => {
    const r = ReactionSchema.safeParse({ id: UUID, axis: "vibes", value: "1" });
    expect(r.success).toBe(false);
  });
  it("отклоняет value 0", () => {
    const r = ReactionSchema.safeParse({ id: UUID, axis: "quality", value: "0" });
    expect(r.success).toBe(false);
  });
});

describe("RemoveReactionSchema", () => {
  it("принимает валидную ось", () => {
    const r = RemoveReactionSchema.safeParse({ id: UUID, axis: "insight" });
    expect(r.success).toBe(true);
  });
  it("отклоняет неизвестную ось", () => {
    const r = RemoveReactionSchema.safeParse({ id: UUID, axis: "x" });
    expect(r.success).toBe(false);
  });
});

describe("CommentIdSchema", () => {
  it("принимает uuid", () => { expect(CommentIdSchema.safeParse({ id: UUID }).success).toBe(true); });
  it("отклоняет не-uuid", () => { expect(CommentIdSchema.safeParse({ id: "x" }).success).toBe(false); });
});
