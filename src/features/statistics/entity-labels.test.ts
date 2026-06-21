// src/features/statistics/entity-labels.test.ts
import { describe, expect, it } from "vitest";

import type { NamespaceT } from "@/i18n";

import { entityLabels } from "./entity-labels";

// Стаб-переводчик: возвращает ключ как есть, удовлетворяет форме NamespaceT.
const t = ((key: string) => key) as unknown as NamespaceT<"statistics">;

describe("entityLabels", () => {
  it("строит лукап по всем типам сущностей через t(entityType.*)", () => {
    expect(entityLabels(t)).toEqual({
      lecture: "entityType.lecture",
      document: "entityType.document",
      trail: "entityType.trail",
      canvas: "entityType.canvas",
      form: "entityType.form",
      media: "entityType.media",
      annotation: "entityType.annotation",
      comment: "entityType.comment",
    });
  });
});
