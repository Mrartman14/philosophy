import { describe, it, expect } from "vitest";

import { rethrowApiError } from "./api-error";
import { BannedError, ForbiddenError } from "./permissions";
import { ZodValidationError } from "./create-action";

/** Ловит брошенную ошибку для проверки её класса/полей. */
function caught(fn: () => never): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("ожидался throw, но его не было");
}

describe("rethrowApiError — общие 403-коли", () => {
  it("FORBIDDEN → ForbiddenError('role') (createAction даст code=forbidden)", () => {
    const err = caught(() => rethrowApiError({ code: "FORBIDDEN" }));
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as ForbiddenError).reason).toBe("role");
  });

  it("ATTACH_FORBIDDEN → ForbiddenError('role')", () => {
    const err = caught(() => rethrowApiError({ code: "ATTACH_FORBIDDEN" }));
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as ForbiddenError).reason).toBe("role");
  });

  it("UPLOAD_FOREIGN → ForbiddenError('role')", () => {
    const err = caught(() => rethrowApiError({ code: "UPLOAD_FOREIGN" }));
    expect((err as ForbiddenError).reason).toBe("role");
  });
});

describe("rethrowApiError — ограничение аккаунта", () => {
  it("SUSPENDED → ForbiddenError('status')", () => {
    const err = caught(() => rethrowApiError({ code: "SUSPENDED" }));
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as ForbiddenError).reason).toBe("status");
  });

  it("BANNED → BannedError", () => {
    const err = caught(() => rethrowApiError({ code: "BANNED", error: "account banned" }));
    expect(err).toBeInstanceOf(BannedError);
    expect((err as BannedError).message).toBe("account banned");
  });

  it("SUSPENDED с error → пробрасывает текст бека", () => {
    expect(() =>
      rethrowApiError({ code: "SUSPENDED", error: "вы ограничены" }),
    ).toThrow("вы ограничены");
  });

  it("SUSPENDED без error → дефолтный текст", () => {
    expect(() => rethrowApiError({ code: "SUSPENDED" })).toThrow(
      "Аккаунт ограничен.",
    );
  });
});

describe("rethrowApiError — доменные коды и overrides", () => {
  it("override переопределяет дефолт для одного кода", () => {
    expect(() =>
      rethrowApiError(
        { code: "REF_NOT_FOUND" },
        { REF_NOT_FOUND: "Локальный текст про ссылку." },
      ),
    ).toThrow("Локальный текст про ссылку.");
  });

  it("без override берётся дефолт (REF_NOT_FOUND)", () => {
    expect(() => rethrowApiError({ code: "REF_NOT_FOUND" })).toThrow(
      "Одна из ссылок указывает на несуществующий объект.",
    );
  });

  it("код только в override-карте слайса (INVALID_DATE)", () => {
    expect(() =>
      rethrowApiError(
        { code: "INVALID_DATE" },
        { INVALID_DATE: "Дата отклонена." },
      ),
    ).toThrow("Дата отклонена.");
  });
});

describe("rethrowApiError — фоллбек", () => {
  it("неизвестный код с error → пробрасывает текст бека", () => {
    expect(() =>
      rethrowApiError({ code: "INTERNAL", error: "internal error" }),
    ).toThrow("internal error");
  });

  it("известный код без маппинга и без override → фоллбек на error", () => {
    expect(() =>
      rethrowApiError({ code: "CONFLICT", error: "конфликт ресурса" }),
    ).toThrow("конфликт ресурса");
  });

  it("undefined → «Ошибка сервера»", () => {
    expect(() => rethrowApiError(undefined)).toThrow("Ошибка сервера");
  });

  it("код без текста и без error → «Ошибка сервера»", () => {
    expect(() => rethrowApiError({ code: "INTERNAL" })).toThrow(
      "Ошибка сервера",
    );
  });
});

describe("rethrowApiError — серверный 422 fields", () => {
  it("бросает ZodValidationError с раскладкой по полям", () => {
    try {
      rethrowApiError({ code: "VALIDATION_ERROR", error: "Проверьте поля", fields: { title: "Обязательно" } });
      throw new Error("должно было бросить");
    } catch (e) {
      expect(e).toBeInstanceOf(ZodValidationError);
      expect((e as ZodValidationError).fieldErrors).toEqual({ title: "Обязательно" });
    }
  });

  it("без fields ведёт себя как раньше (общий Error)", () => {
    expect(() => rethrowApiError({ code: "VERSION_MISMATCH", error: "x" }))
      .toThrow("Объект изменён в другом месте. Обновите страницу и повторите.");
  });
});

describe("rethrowApiError idempotency codes", () => {
  it("maps IDEMPOTENCY_KEY_IN_USE to a wait message", () => {
    expect(() => rethrowApiError({ code: "IDEMPOTENCY_KEY_IN_USE" })).toThrow(
      /уже обрабатывается/i,
    );
  });

  it("maps IDEMPOTENCY_KEY_REUSED to a conflict message", () => {
    expect(() => rethrowApiError({ code: "IDEMPOTENCY_KEY_REUSED" })).toThrow(
      /конфликтует/i,
    );
  });

  it("maps IDEMPOTENCY_KEY_INVALID to a refresh message", () => {
    expect(() => rethrowApiError({ code: "IDEMPOTENCY_KEY_INVALID" })).toThrow(
      /ключ идемпотентности/i,
    );
  });
});
