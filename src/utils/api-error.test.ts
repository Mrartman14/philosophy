import { describe, it, expect } from "vitest";

import { rethrowApiError } from "./api-error";
import { ApiMessageError, ZodValidationError } from "./create-action";
import { BannedError, ForbiddenError } from "./permissions";

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
    const err = caught(() =>
      rethrowApiError({ code: "SUSPENDED", error: "вы ограничены" }),
    );
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as ForbiddenError).message).toBe("вы ограничены");
  });

  it("SUSPENDED без error → Forbidden('status') без бакнутого текста (клиент рисует branded errors.accountRestricted)", () => {
    const err = caught(() => rethrowApiError({ code: "SUSPENDED" }));
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as ForbiddenError).reason).toBe("status");
    // message — дефолтный «Forbidden: status», НЕ бакнутый русский текст.
    expect((err as ForbiddenError).message).toBe("Forbidden: status");
  });
});

describe("rethrowApiError — доменные коды и overrides (несут ключ каталога)", () => {
  it("override переопределяет дефолтный ключ для одного кода", () => {
    const err = caught(() =>
      rethrowApiError(
        { code: "REF_NOT_FOUND" },
        // override указывает на другой ключ каталога (здесь — переиспользуем
        // accountRestricted чисто как валидный ErrorKey для проверки приоритета).
        { REF_NOT_FOUND: "accountRestricted" },
      ),
    );
    expect(err).toBeInstanceOf(ApiMessageError);
    expect((err as ApiMessageError).messageKey).toBe("accountRestricted");
  });

  it("без override берётся дефолтный ключ (REF_NOT_FOUND)", () => {
    const err = caught(() => rethrowApiError({ code: "REF_NOT_FOUND" }));
    expect(err).toBeInstanceOf(ApiMessageError);
    expect((err as ApiMessageError).messageKey).toBe("REF_NOT_FOUND");
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

  it("undefined → ApiMessageError('serverError')", () => {
    const err = caught(() => rethrowApiError(undefined));
    expect(err).toBeInstanceOf(ApiMessageError);
    expect((err as ApiMessageError).messageKey).toBe("serverError");
  });

  it("код без текста и без error → ApiMessageError('serverError')", () => {
    const err = caught(() => rethrowApiError({ code: "INTERNAL" }));
    expect(err).toBeInstanceOf(ApiMessageError);
    expect((err as ApiMessageError).messageKey).toBe("serverError");
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

  it("без fields ведёт себя как раньше (ApiMessageError с ключом кода)", () => {
    const err = caught(() => rethrowApiError({ code: "VERSION_MISMATCH", error: "x" }));
    expect(err).toBeInstanceOf(ApiMessageError);
    expect((err as ApiMessageError).messageKey).toBe("VERSION_MISMATCH");
  });

  // Защитный кейс от дрейфа контракта: если бек пришлёт fields вместе с BANNED,
  // форс-логаут должен сработать, а не проглотиться ZodValidationError.
  it("BANNED + fields → BannedError (fields НЕ проглатывают форс-логаут)", () => {
    const err = caught(() =>
      rethrowApiError({ code: "BANNED", error: "x", fields: { a: "b" } }),
    );
    expect(err).toBeInstanceOf(BannedError);
  });
});

describe("rethrowApiError idempotency codes (несут ключ каталога)", () => {
  it("maps IDEMPOTENCY_KEY_IN_USE to its catalog key", () => {
    const err = caught(() => rethrowApiError({ code: "IDEMPOTENCY_KEY_IN_USE" }));
    expect((err as ApiMessageError).messageKey).toBe("IDEMPOTENCY_KEY_IN_USE");
  });

  it("maps IDEMPOTENCY_KEY_REUSED to its catalog key", () => {
    const err = caught(() => rethrowApiError({ code: "IDEMPOTENCY_KEY_REUSED" }));
    expect((err as ApiMessageError).messageKey).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("maps IDEMPOTENCY_KEY_INVALID to its catalog key", () => {
    const err = caught(() => rethrowApiError({ code: "IDEMPOTENCY_KEY_INVALID" }));
    expect((err as ApiMessageError).messageKey).toBe("IDEMPOTENCY_KEY_INVALID");
  });
});

describe("rethrowApiError — 413 (несут ключ каталога)", () => {
  it("REQUEST_BODY_TOO_LARGE → ApiMessageError('REQUEST_BODY_TOO_LARGE')", () => {
    const err = caught(() => rethrowApiError({ code: "REQUEST_BODY_TOO_LARGE" }));
    expect(err).toBeInstanceOf(ApiMessageError);
    expect((err as ApiMessageError).messageKey).toBe("REQUEST_BODY_TOO_LARGE");
  });

  it("PAYLOAD_TOO_LARGE → ApiMessageError('PAYLOAD_TOO_LARGE')", () => {
    const err = caught(() => rethrowApiError({ code: "PAYLOAD_TOO_LARGE" }));
    expect(err).toBeInstanceOf(ApiMessageError);
    expect((err as ApiMessageError).messageKey).toBe("PAYLOAD_TOO_LARGE");
  });

  it("слайс-override приоритетнее общего ключа", () => {
    const err = caught(() =>
      rethrowApiError(
        { code: "REQUEST_BODY_TOO_LARGE" },
        { REQUEST_BODY_TOO_LARGE: "CANVAS_PAYLOAD_TOO_LARGE" },
      ),
    );
    expect(err).toBeInstanceOf(ApiMessageError);
    expect((err as ApiMessageError).messageKey).toBe("CANVAS_PAYLOAD_TOO_LARGE");
  });
});
