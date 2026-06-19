// src/features/preferences/schemas.test.ts
import { describe, it, expect } from "vitest";

import type { NamespaceT } from "@/i18n";

import {
  makePushSendSchema,
  makePushSubscribeSchema,
  makePushUnsubscribeSchema,
  PreferencesUpdateSchema,
} from "./schemas";

// Фейковый переводчик: возвращает ключ как текст (сообщение не проверяем — только
// success/data). Образец для тестов любой схемы-фабрики makeXSchema(t).
const t = ((key: string) => key) as unknown as NamespaceT<"validation">;
const PushSendSchema = makePushSendSchema(t);
const PushSubscribeSchema = makePushSubscribeSchema(t);
const PushUnsubscribeSchema = makePushUnsubscribeSchema(t);

describe("PreferencesUpdateSchema", () => {
  it("принимает reading_mode=full", () => {
    expect(
      PreferencesUpdateSchema.safeParse({ reading_mode: "full" }).success,
    ).toBe(true);
  });
  it("принимает reading_mode=focused", () => {
    expect(
      PreferencesUpdateSchema.safeParse({ reading_mode: "focused" }).success,
    ).toBe(true);
  });
  it("отклоняет неизвестный режим", () => {
    expect(
      PreferencesUpdateSchema.safeParse({ reading_mode: "compact" }).success,
    ).toBe(false);
  });
  it("отклоняет отсутствующее поле", () => {
    expect(PreferencesUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("PushSubscribeSchema", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    keys: { p256dh: "BPk-key", auth: "auth-secret" },
  };
  it("принимает валидную подписку", () => {
    expect(PushSubscribeSchema.safeParse(valid).success).toBe(true);
  });
  it("отбрасывает лишние поля из PushSubscription.toJSON() (expirationTime)", () => {
    const r = PushSubscribeSchema.safeParse({ ...valid, expirationTime: null });
    expect(r.success).toBe(true);
    if (r.success) expect("expirationTime" in r.data).toBe(false);
  });
  it("отклоняет не-URL endpoint", () => {
    expect(
      PushSubscribeSchema.safeParse({ ...valid, endpoint: "not-a-url" })
        .success,
    ).toBe(false);
  });
  it("отклоняет пустой p256dh", () => {
    expect(
      PushSubscribeSchema.safeParse({
        ...valid,
        keys: { p256dh: "", auth: "x" },
      }).success,
    ).toBe(false);
  });
  it("отклоняет отсутствующие keys", () => {
    expect(
      PushSubscribeSchema.safeParse({ endpoint: valid.endpoint }).success,
    ).toBe(false);
  });
});

describe("PushUnsubscribeSchema", () => {
  it("принимает валидный endpoint", () => {
    expect(
      PushUnsubscribeSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      }).success,
    ).toBe(true);
  });
  it("отклоняет не-URL endpoint", () => {
    expect(PushUnsubscribeSchema.safeParse({ endpoint: "abc" }).success).toBe(
      false,
    );
  });
});

describe("PushSendSchema", () => {
  it("принимает полный payload", () => {
    const r = PushSendSchema.safeParse({
      title: "Новая лекция",
      body: "Платон. Государство",
      url: "/lectures/abc",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        title: "Новая лекция",
        body: "Платон. Государство",
        url: "/lectures/abc",
      });
    }
  });
  it("превращает пустые body/url из FormData в undefined", () => {
    const r = PushSendSchema.safeParse({ title: "Заголовок", body: "", url: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.body).toBeUndefined();
      expect(r.data.url).toBeUndefined();
    }
  });
  it("принимает абсолютный https-URL", () => {
    expect(
      PushSendSchema.safeParse({ title: "t", url: "https://example.com/x" })
        .success,
    ).toBe(true);
  });
  it("отклоняет пустой title", () => {
    expect(PushSendSchema.safeParse({ title: "  " }).success).toBe(false);
  });
  it("отклоняет title длиннее 200", () => {
    expect(PushSendSchema.safeParse({ title: "a".repeat(201) }).success).toBe(
      false,
    );
  });
  it("отклоняет url-схему, отличную от пути или http(s)", () => {
    expect(
      PushSendSchema.safeParse({ title: "t", url: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });
  it("отклоняет body длиннее 1000", () => {
    expect(
      PushSendSchema.safeParse({ title: "t", body: "a".repeat(1001) }).success,
    ).toBe(false);
  });
});
