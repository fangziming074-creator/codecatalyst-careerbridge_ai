// Server-only adapter. No automatic retries or silent paid-provider fallback.
export class AIError extends Error {
  constructor(status, message) { super(message); this.status = status; this.publicMessage = message; }
}

export function createRunpod(env = process.env, fetcher = fetch) {
  const endpoint = env.RUNPOD_ENDPOINT_ID || "";
  const key = env.RUNPOD_API_KEY || "";
  const model = env.RUNPOD_MODEL || "";
  const configured = /^[a-zA-Z0-9_-]{1,100}$/.test(endpoint) && Boolean(key && model);
  const timeout = Math.max(1000, Math.min(120000, Number(env.RUNPOD_TIMEOUT_MS) || 120000));
  let active = 0;
  return {
    configured,
    model,
    async complete(messages, { json = false, maxTokens = 2400 } = {}) {
      if (!configured) throw new AIError(503, "Runpod is not configured. / Runpod 尚未配置。");
      if (active >= 4) throw new AIError(429, "AI is busy. Please retry later. / AI 繁忙，请稍后重试。");
      active++;
      try {
        const response = await fetcher(`https://api.runpod.ai/v2/${endpoint}/openai/v1/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model, messages, temperature: 0.2,
            max_tokens: Math.min(8000, Math.max(1, maxTokens)),
            ...(json ? { response_format: { type: "json_object" } } : {})
          }),
          signal: AbortSignal.timeout(timeout)
        });
        if (!response.ok) {
          throw new AIError(response.status === 429 ? 429 : 502,
            "AI service unavailable. Check configuration or retry later. / AI 服务不可用，请检查配置或稍后重试。");
        }
        // Bound the response as it arrives, not just after buffering.
        const chunks = [];
        let bytes = 0;
        for await (const chunk of response.body) {
          bytes += chunk.length;
          if (bytes > 256 * 1024) throw new AIError(502, "AI response is too large. / AI 返回内容过长。");
          chunks.push(chunk);
        }
        let data;
        try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch { throw new AIError(502, "Invalid AI response. / AI 返回格式无效。"); }
        const choice = data?.choices?.[0];
        if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string" || !choice.message.content.trim()) {
          throw new AIError(502, "AI response incomplete. Please retry. / AI 结果不完整，请重试。");
        }
        return data;
      } catch (error) {
        if (error instanceof AIError) throw error;
        throw new AIError(error?.name === "TimeoutError" ? 504 : 502,
          "AI request failed or timed out. Please retry. / AI 请求失败或超时，请重试。");
      } finally { active--; }
    }
  };
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
