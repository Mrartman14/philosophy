export function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("must(): expected non-null value");
  return value;
}
