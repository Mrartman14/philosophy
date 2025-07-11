export async function withMinDelay<T>(promise: Promise<T>, ms = 1000) {
  const [result] = await Promise.all([
    promise,
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
  return result;
}
