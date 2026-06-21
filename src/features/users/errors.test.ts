/**
 * Поведенческие тесты маппинга ошибок бекенда в users/actions.ts.
 *
 * `rethrowUserApiError` теперь приватная local-функция actions.ts (канон —
 * как `rethrowTrailApiError` в trails/actions.ts), поэтому проверяем её через
 * публичный server action `setUserStatus`: мокаем API так, чтобы PUT вернул
 * нужный { code, error }, и смотрим на итоговый результат createAction.
 *
 * Гейт RBAC проходит (admin с user.moderate); создаём ту же среду, что и в
 * actions-rbac.test.ts. Маппинг createAction:
 *   ForbiddenError            → { success: false, code: "forbidden" }
 *   ApiMessageError(key)      → { success: false, error: <resolved key> }
 *   BannedError               → redirect("/auth/forced-logout") (throw NEXT_REDIRECT)
 *   прочий throw new Error(t) → { success: false, error: t }
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mutating verb spy ─────────────────────────────────────────────────────────
const put = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
}));

const getMeImpl = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMeImpl() as unknown }));

vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// getT возвращает identity — resolveErrorMessage отдаёт ключ как есть.
vi.mock("@/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n")>();
  return {
    ...actual,
    getT: () => Promise.resolve((key: string) => key),
  };
});

// next/navigation — BannedError ведёт к redirect. Фабрика vi.mock хоистится,
// поэтому redirect определяется инлайн (нельзя ссылаться на top-level const) и
// кладёт целевой url в digest — по нему проверяем направление редиректа.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

// Import action AFTER vi.mock (hoisted ordering).
import { setUserStatus } from "./actions";

const TARGET_USER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const adminMe: import("@/utils/me").Me = {
  id: "admin-id",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["user.moderate"],
};

/** Прогоняет setUserStatus при заданной ошибке от PUT. */
function runWithError(error: { code: string; error: string }) {
  put.mockResolvedValue({ data: undefined, error });
  return setUserStatus({ id: TARGET_USER_ID, status: "active" });
}

beforeEach(() => {
  put.mockReset();
  getMeImpl.mockReset();
  getMeImpl.mockResolvedValue(adminMe);
});

describe("rethrowUserApiError (через setUserStatus)", () => {
  it("FORBIDDEN → { success: false, code: 'forbidden' }", async () => {
    const result = await runWithError({ code: "FORBIDDEN", error: "forbidden" });
    expect(result).toMatchObject({ success: false, code: "forbidden" });
  });

  it("CONFLICT: cannot modify your own status → русский текст", async () => {
    const result = await runWithError({
      code: "CONFLICT",
      error: "cannot modify your own status",
    });
    expect(result).toMatchObject({
      success: false,
      error: "Нельзя изменить собственный статус.",
    });
  });

  it("CONFLICT: cannot modify your own role → русский текст", async () => {
    const result = await runWithError({
      code: "CONFLICT",
      error: "cannot modify your own role",
    });
    expect(result).toMatchObject({
      success: false,
      error: "Нельзя изменить собственную роль.",
    });
  });

  it("CONFLICT: cannot remove the last active admin → русский текст", async () => {
    const result = await runWithError({
      code: "CONFLICT",
      error: "cannot remove the last active admin",
    });
    expect(result).toMatchObject({
      success: false,
      error:
        "Нельзя приостановить или заблокировать последнего активного администратора.",
    });
  });

  it("CONFLICT: cannot demote the last active admin → русский текст", async () => {
    const result = await runWithError({
      code: "CONFLICT",
      error: "cannot demote the last active admin",
    });
    expect(result).toMatchObject({
      success: false,
      error: "Нельзя понизить роль последнего активного администратора.",
    });
  });

  it("CONFLICT с неизвестным текстом → общий фоллбек, не raw-текст", async () => {
    const result = await runWithError({
      code: "CONFLICT",
      error: "something else",
    });
    expect(result).toMatchObject({
      success: false,
      error: "Операция отклонена сервером (конфликт).",
    });
  });

  it("NOT_FOUND → ApiMessageError('USER_NOT_FOUND') → локализованный текст", async () => {
    const result = await runWithError({ code: "NOT_FOUND", error: "user not found" });
    // resolveErrorMessage в createAction берёт реальный каталог errors (мок getT
    // влияет только на schema-parse внутри action), ключ → русский текст.
    expect(result).toMatchObject({ success: false, error: "Пользователь не найден." });
  });

  it("SUSPENDED → ForbiddenError('status') → { code: 'forbidden' }", async () => {
    const result = await runWithError({
      code: "SUSPENDED",
      error: "account suspended",
    });
    expect(result).toMatchObject({ success: false, code: "forbidden" });
  });

  it("BANNED → BannedError → redirect('/auth/forced-logout')", async () => {
    // redirect() бросает NEXT_REDIRECT с целевым url в digest — проверяем оба.
    const thrown = await runWithError({
      code: "BANNED",
      error: "account banned",
    }).then(
      () => {
        throw new Error("ожидался throw redirect, но action вернул результат");
      },
      (e: unknown) => e as Error & { digest?: string },
    );
    expect(thrown.message).toBe("NEXT_REDIRECT");
    expect(thrown.digest).toBe("NEXT_REDIRECT;/auth/forced-logout");
  });

  it("неизвестный код → пробрасывает error-текст", async () => {
    const result = await runWithError({
      code: "INTERNAL",
      error: "internal server error",
    });
    expect(result).toMatchObject({
      success: false,
      error: "internal server error",
    });
  });

  // NB: ветка rethrowUserApiError(undefined) → ApiMessageError("serverError")
  // через публичный action недостижима: action вызывает обёртку под охраной
  // `if (error)`, поэтому undefined в неё не попадает (defensive-only код, как и
  // в trails/rethrowTrailApiError — приватный, не покрывается напрямую).
});
