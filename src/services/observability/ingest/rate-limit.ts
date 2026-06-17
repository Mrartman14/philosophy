// Per-session token bucket для /api/telemetry. Single-node, in-memory —
// достаточно для одного инстанса. Ключ — sessionId.
interface BucketState {
  tokens: number;
  last: number;
}

export function createTokenBucket(opts: {
  capacity: number;
  refillPerSec: number;
  now?: () => number;
}): { allow(key: string): boolean } {
  const now = opts.now ?? Date.now;
  const buckets = new Map<string, BucketState>();

  return {
    allow(key: string): boolean {
      const t = now();
      const state = buckets.get(key) ?? { tokens: opts.capacity, last: t };
      const elapsedSec = Math.max(0, (t - state.last) / 1000);
      const refilled = Math.min(
        opts.capacity,
        state.tokens + elapsedSec * opts.refillPerSec,
      );
      if (refilled < 1) {
        buckets.set(key, { tokens: refilled, last: t });
        return false;
      }
      buckets.set(key, { tokens: refilled - 1, last: t });
      return true;
    },
  };
}
