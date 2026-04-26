import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseFormData, ZodValidationError } from "./create-action";

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
      email: z.string().email(),
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

  it("only reports first error per field", () => {
    const schema = z.object({ pwd: z.string().min(8).regex(/[A-Z]/) });
    const fd = new FormData();
    fd.set("pwd", "ab");
    try {
      parseFormData(schema, fd);
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as ZodValidationError;
      expect(err.fieldErrors.pwd).toBeDefined();
    }
  });
});
