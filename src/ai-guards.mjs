// Shared request errors and in-process account limits for AI features.
export class AIError extends Error {
  constructor(status, message) { super(message); this.status = status; this.publicMessage = message; }
}

// Per-process safety guard. A multi-replica deployment must use shared limits.
export function createAIBudget(limit = 10, now = Date.now) {
  const buckets = new Map();
  const busy = new Set();
  return {
    acquire(userId) {
      const time = now();
      for (const [id, bucket] of buckets) if (bucket.until <= time && !busy.has(id)) buckets.delete(id);
      if (busy.has(userId)) throw new AIError(409, "A request is already running. / 已有请求正在生成。");
      let bucket = buckets.get(userId);
      if (!bucket || bucket.until <= time) bucket = { count: 0, until: time + 3600000 };
      if (bucket.count >= limit || (!buckets.has(userId) && buckets.size >= 10000)) {
        throw new AIError(429, "AI usage limit reached. Try later. / 已达到 AI 使用上限，请稍后重试。");
      }
      bucket.count++;
      buckets.set(userId, bucket);
      busy.add(userId);
      return () => busy.delete(userId);
    }
  };
}
