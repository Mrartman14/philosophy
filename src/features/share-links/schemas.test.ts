// src/features/share-links/schemas.test.ts
import { describe, expect, it } from "vitest";

import type { NamespaceT } from "@/i18n";

import {
  makeShareLinkCreateSchema,
  ShareLinkLookupSchema,
  makeRevokeTokenSchema,
} from "./schemas";

// Stub translator: returns key as-is (паттерн из playbook Case 1).
const t = ((key: string) => key) as unknown as NamespaceT<"validation">;
const ShareLinkCreateSchema = makeShareLinkCreateSchema(t);
const RevokeTokenSchema = makeRevokeTokenSchema(t);

describe("ShareLinkCreateSchema", () => {
  it("принимает валидный create без expires_at", () => {
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "document",
      resource_id: "doc-1",
    });
    expect(r.success).toBe(true);
  });

  it("принимает валидный create с будущим expires_at и нормализует в ISO", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "lecture",
      resource_id: "lec-1",
      expires_at: future,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    }
  });

  it("отклоняет неизвестный resource_type", () => {
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "banner",
      resource_id: "b-1",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет canvas в create (вне скоупа фронта)", () => {
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "canvas",
      resource_id: "c-1",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет пустой resource_id", () => {
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "media",
      resource_id: "",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет некорректную дату expires_at", () => {
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "form",
      resource_id: "f-1",
      expires_at: "не-дата",
    });
    expect(r.success).toBe(false);
  });
});

describe("ShareLinkLookupSchema", () => {
  it("принимает любой backend-тип, включая canvas", () => {
    expect(
      ShareLinkLookupSchema.safeParse({
        resource_type: "canvas",
        resource_id: "c-1",
      }).success,
    ).toBe(true);
  });

  it("отклоняет мусорный resource_type", () => {
    expect(
      ShareLinkLookupSchema.safeParse({
        resource_type: "xxx",
        resource_id: "id",
      }).success,
    ).toBe(false);
  });

  it("отклоняет пустой resource_id", () => {
    expect(
      ShareLinkLookupSchema.safeParse({
        resource_type: "document",
        resource_id: "   ",
      }).success,
    ).toBe(false);
  });
});

describe("RevokeTokenSchema", () => {
  it("принимает непустой токен", () => {
    expect(RevokeTokenSchema.safeParse({ token: "abc123" }).success).toBe(true);
  });

  it("отклоняет пустой токен", () => {
    expect(RevokeTokenSchema.safeParse({ token: "" }).success).toBe(false);
  });
});
