import { describe, expect, it } from "vitest";

import { selectAnchoredRoots } from "./anchored";
import type { RootSubtree } from "./types";

const textAnchor = (docId: string) => ({
  target_entity_type: "document" as const,
  target_entity_id: docId,
  start_block_id: "b1",
  end_block_id: "b1",
  start_char: 0,
  end_char: 3,
  exact: "abc",
});

describe("selectAnchoredRoots", () => {
  it("берёт корни с text-якорем на нужный документ + считает ответы", () => {
    const subtrees: RootSubtree[] = [
      {
        root: { id: "c1", created_at: "", updated_at: "", lecture_id: "L", type: "claim", anchor: textAnchor("doc-1") },
        descendants: [
          { id: "c2", created_at: "", updated_at: "", lecture_id: "L", type: "grounds", parent_id: "c1" },
        ],
      },
    ];
    const r = selectAnchoredRoots(subtrees, "doc-1");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "c1", replyCount: 1 });
    expect(r[0]?.anchor.target_entity_id).toBe("doc-1");
  });

  it("отсеивает чужой документ", () => {
    const subtrees: RootSubtree[] = [
      { root: { id: "c1", created_at: "", updated_at: "", lecture_id: "L", type: "claim", anchor: textAnchor("doc-OTHER") }, descendants: [] },
    ];
    expect(selectAnchoredRoots(subtrees, "doc-1")).toHaveLength(0);
  });

  it("отсеивает корни без якоря и media-якоря", () => {
    const subtrees: RootSubtree[] = [
      { root: { id: "c1", created_at: "", updated_at: "", lecture_id: "L", type: "claim" }, descendants: [] },
      {
        root: {
          id: "c2", created_at: "", updated_at: "", lecture_id: "L", type: "claim",
          anchor: { target_entity_type: "media", target_entity_id: "m1", start_sec: 1, end_sec: 2 },
        },
        descendants: [],
      },
    ];
    expect(selectAnchoredRoots(subtrees, "doc-1")).toHaveLength(0);
  });

  it("отсеивает удалённый корень (is_deleted) даже с валидным text-якорем", () => {
    const subtrees: RootSubtree[] = [
      {
        root: {
          id: "c1", created_at: "", updated_at: "", lecture_id: "L", type: "claim",
          is_deleted: true, anchor: textAnchor("doc-1"),
        },
        descendants: [],
      },
    ];
    expect(selectAnchoredRoots(subtrees, "doc-1")).toHaveLength(0);
  });
});
