import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

import {
  createAction,
  createFormAction,
  parseFormData,
  ZodValidationError,
} from "./create-action";
import { IDEMPOTENCY_FIELD } from "./idempotency";
import { BannedError, ForbiddenError } from "./permissions";

describe("parseFormData", () => {
  it("returns parsed object on valid FormData", () => {
    const schema = z.object({ name: z.string().min(1), age: z.coerce.number() });
    const fd = new FormData();
    fd.set("name", "Alice");
    fd.set("age", "30");
    expect(parseFormData(schema, fd)).toEqual({ name: "Alice", age: 30 });
  });

  it("throws ZodValidationError with fieldErrors map on invalid data", () => {
    const schema = z.object({
      email: z.email(),
      name: z.string().min(2),
    });
    const fd = new FormData();
    fd.set("email", "not-an-email");
    fd.set("name", "A");
    try {
      parseFormData(schema, fd);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ZodValidationError);
      const err = e as ZodValidationError;
      expect(Object.keys(err.fieldErrors)).toEqual(
        expect.arrayContaining(["email", "name"])
      );
      expect(typeof err.fieldErrors.email).toBe("string");
      expect(typeof err.fieldErrors.name).toBe("string");
    }
  });

  it("only reports first error per field (first issue's message wins)", () => {
    const schema = z.object({ pwd: z.string().min(8).regex(/[A-Z]/) });
    const fd = new FormData();
    fd.set("pwd", "ab");
    // Compute the expected "first" message directly from Zod.
    const expectedFirstMessage = schema.safeParse({ pwd: "ab" }).error?.issues[0]?.message;
    expect(expectedFirstMessage).toBeDefined();
    try {
      parseFormData(schema, fd);
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as ZodValidationError;
      expect(err.fieldErrors.pwd).toBe(expectedFirstMessage);
    }
  });

  it("routes cross-field errors (empty path) to _form key", () => {
    const schema = z
      .object({ a: z.string(), b: z.string() })
      .refine((v) => v.a === v.b, { message: "a and b must match" });
    const fd = new FormData();
    fd.set("a", "x");
    fd.set("b", "y");
    try {
      parseFormData(schema, fd);
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as ZodValidationError;
      expect(err.fieldErrors._form).toBe("a and b must match");
    }
  });
});

describe("createFormAction", () => {
  it("returns success on happy path", async () => {
    const action = createFormAction((fd: FormData) => Promise.resolve(fd.get("x") as string));
    const fd = new FormData();
    fd.set("x", "ok");
    const result = await action({ success: false, error: "" }, fd);
    expect(result).toEqual({ success: true, data: "ok" });
  });

  it("returns code='forbidden' on ForbiddenError", async () => {
    const action = createFormAction(() => {
      throw new ForbiddenError("role");
    });
    const result = await action({ success: false, error: "" }, new FormData());
    expect(result).toMatchObject({ success: false, code: "forbidden" });
  });

  it("returns code='validation' with fieldErrors on ZodValidationError", async () => {
    const schema = z.object({ email: z.email() });
    const action = createFormAction((fd: FormData) => {
      parseFormData(schema, fd);
      return Promise.resolve(null);
    });
    const fd = new FormData();
    fd.set("email", "bad");
    const result = await action({ success: false, error: "" }, fd);
    expect(result).toMatchObject({
      success: false,
      code: "validation",
      fieldErrors: expect.objectContaining({ email: expect.any(String) as unknown }) as unknown,
    });
  });

  it("returns generic error for unknown errors", async () => {
    const action = createFormAction(() => {
      throw new Error("boom");
    });
    const result = await action({ success: false, error: "" }, new FormData());
    expect(result).toEqual({ success: false, error: "boom" });
    expect((result as { code?: string }).code).toBeUndefined();
  });
});

describe("ZodValidationError", () => {
  it("is also caught directly by createFormAction (without parseFormData wrapping)", async () => {
    const action = createFormAction(() => {
      throw new ZodValidationError({ x: "must be set" });
    });
    const result = await action({ success: false, error: "" }, new FormData());
    expect(result).toMatchObject({
      success: false,
      code: "validation",
      fieldErrors: { x: "must be set" },
    });
  });
});

describe("createAction idempotency context", () => {
  it("passes idempotencyKey to the handler when provided", async () => {
    let received: string | undefined = "UNSET";
    const action = createAction((_input: number, ctx) => {
      received = ctx.idempotencyKey;
      return Promise.resolve(null);
    });
    await action(1, "key-7");
    expect(received).toBe("key-7");
  });
  it("passes undefined when no key is provided", async () => {
    let received: string | undefined = "UNSET";
    const action = createAction((_input: number, ctx) => {
      received = ctx.idempotencyKey;
      return Promise.resolve(null);
    });
    await action(1);
    expect(received).toBeUndefined();
  });
});

describe("createFormAction idempotency context", () => {
  it("passes idempotencyKey from the hidden field to the handler", async () => {
    let received: string | undefined = "UNSET";
    const action = createFormAction((_fd: FormData, ctx) => {
      received = ctx.idempotencyKey;
      return Promise.resolve(null);
    });
    const fd = new FormData();
    fd.set(IDEMPOTENCY_FIELD, "key-42");
    await action({ success: false, error: "" }, fd);
    expect(received).toBe("key-42");
  });

  it("passes undefined when the field is absent", async () => {
    let received: string | undefined = "UNSET";
    const action = createFormAction((_fd: FormData, ctx) => {
      received = ctx.idempotencyKey;
      return Promise.resolve(null);
    });
    await action({ success: false, error: "" }, new FormData());
    expect(received).toBeUndefined();
  });
});

describe("forced logout on BannedError", () => {
  it("createFormAction: BannedError → redirect на /auth/forced-logout", async () => {
    const action = createFormAction(() => {
      throw new BannedError();
    });
    let digest: string | undefined;
    try {
      await action({ success: false, error: "" }, new FormData());
    } catch (e) {
      digest = (e as { digest?: string }).digest;
    }
    expect(digest).toBe("NEXT_REDIRECT;/auth/forced-logout");
  });

  it("createAction: BannedError → redirect на /auth/forced-logout", async () => {
    const action = createAction(() => {
      throw new BannedError();
    });
    let digest: string | undefined;
    try {
      await action(undefined);
    } catch (e) {
      digest = (e as { digest?: string }).digest;
    }
    expect(digest).toBe("NEXT_REDIRECT;/auth/forced-logout");
  });

  it("ForbiddenError по-прежнему → code=forbidden (не редиректит)", async () => {
    const action = createFormAction(() => {
      throw new ForbiddenError("role");
    });
    const result = await action({ success: false, error: "" }, new FormData());
    expect(result).toMatchObject({ success: false, code: "forbidden" });
  });
});
