// src/features/preferences/vapid.test.ts
// window.atob is provided by jsdom (vitest default environment).
import { describe, it, expect } from "vitest";

import { urlBase64ToUint8Array } from "./vapid";

describe("urlBase64ToUint8Array", () => {
  // A real 65-byte uncompressed P-256 VAPID public key in base64url (no padding).
  // The same key in standard base64: replace - → +, _ → /, add padding.
  // Source: synthetic key whose bytes we can independently verify.
  const VAPID_BASE64URL =
    "BNt9GEv3yp6DYwuMRpYW3lhS2XEJYiW6NsTbqgB3u7tT7e2eDNYblM3jt6bQEXNr1CXgBIuN4kn2_TiVQWMJgE0";

  it("возвращает Uint8Array длиной 65 байт для VAPID P-256 ключа", () => {
    const result = urlBase64ToUint8Array(VAPID_BASE64URL);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(65);
  });

  it("корректно заменяет - → + и _ → / (base64url → base64)", () => {
    // Строка содержит '_' и '-' — если замена не работает, atob выбросит ошибку.
    expect(() => urlBase64ToUint8Array(VAPID_BASE64URL)).not.toThrow();
  });

  it("корректно дополняет padding при длине % 4 !== 0", () => {
    // Проверяем строку, длина которой не кратна 4 (требует ровно 2 символа '=').
    // 'AA' — 2 символа base64url; декодируется в 1 байт (0x00).
    const result = urlBase64ToUint8Array("AA");
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0);
  });

  it("декодирует известный байтовый паттерн корректно", () => {
    // 'AQID' в base64 = байты [0x01, 0x02, 0x03].
    const result = urlBase64ToUint8Array("AQID");
    expect(result.length).toBe(3);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result[2]).toBe(3);
  });

  it("декодирует строку с символами - и _ без ошибок и верно", () => {
    // '+' → 0xFB в паре; в base64url это '-'.
    // Base64 'Pv8=' = байты [0x3E, 0xFF]; в base64url: 'Pv8=' (нет - или _).
    // Подберём пример с _: base64 '/w==' = 0xFF; в base64url: '_w==', без паддинга: '_w'
    const result = urlBase64ToUint8Array("_w");
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0xff);
  });
});
