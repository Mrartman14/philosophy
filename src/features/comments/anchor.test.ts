import { describe, expect, it } from "vitest";

import { buildCommentTextAnchor } from "./anchor";

describe("buildCommentTextAnchor", () => {
  it("строит comment.Anchor с target=document и координатами", () => {
    expect(
      buildCommentTextAnchor(
        { startBlockId: "b1", startNodeId: "b1", endBlockId: "b2", endNodeId: "b2", startChar: 3, endChar: 7, exact: "слово", prefix: "до ", suffix: " после" },
        "doc-123",
      ),
    ).toEqual({
      target_entity_type: "document",
      target_entity_id: "doc-123",
      start_block_id: "b1",
      start_node_id: "b1",
      end_block_id: "b2",
      end_node_id: "b2",
      start_char: 3,
      end_char: 7,
      exact: "слово",
      prefix: "до ",
      suffix: " после",
    });
  });

  it("опускает пустые prefix/suffix", () => {
    const a = buildCommentTextAnchor(
      { startBlockId: "b1", startNodeId: "b1", endBlockId: "b1", endNodeId: "b1", startChar: 0, endChar: 2, exact: "ab" },
      "doc-1",
    );
    expect(a.prefix).toBeUndefined();
    expect(a.suffix).toBeUndefined();
  });
});
