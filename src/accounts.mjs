import pg from "pg";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const scrypt = promisify(scryptCallback);
const { Pool } = pg;
const COOKIE_NAME = "careerbridge_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_ACCOUNT_BODY_BYTES = 24 * 1024;
const MAX_STATE_BODY_BYTES = 256 * 1024;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_LIMITS = { register: 8, login: 20, recover: 5 };
const buckets = new Map();

class AccountError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.publicMessage = message;
  }
}

function json(res, status, value, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...extraHeaders
  });
  res.end(JSON.stringify(value));
}

async function readJson(req, maxBytes) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > maxBytes) throw new AccountError(413, "提交内容过大。");
    chunks.push(chunk);
  }
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AccountError(400, "请求格式无效。");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AccountError(400, "请求内容格式无效。");
  }
  return value;
}

function requireJson(req) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw new AccountError(415, "请使用 JSON 格式提交。");
  }
}

function normalizeUsername(value) {
  if (typeof value !== "string") throw new AccountError(400, "请填写用户名。");
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    throw new AccountError(400, "用户名需为 3–24 位字母、数字或下划线。");
  }
  return username;
}

function validatePassword(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) {
    throw new AccountError(400, "密码长度需为 12–128 位。");
  }
  return value;
}

function normalizeRecoveryCode(value) {
  if (typeof value !== "string") return "";
  const code = value.replace(/[^a-f0-9]/gi, "").toLowerCase();
  return /^[a-f0-9]{48}$/.test(code) ? code : "";
}

function makeRecoveryCode() {
  const raw = randomBytes(24).toString("hex");
  return { raw, display: raw.toUpperCase().match(/.{1,8}/g).join("-") };
}

async function hashSecret(secret) {
  const salt = randomBytes(16);
  const digest = await scrypt(secret, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return "scrypt$" + salt.toString("base64url") + "$" + digest.toString("base64url");
}

async function verifySecret(secret, encoded) {
  if (typeof encoded !== "string") return false;
  const parts = encoded.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[1], "base64url");
    expected = Buffer.from(parts[2], "base64url");
  } catch {
    return false;
  }
  if (salt.length !== 16 || expected.length !== 64) return false;
  const actual = await scrypt(secret, salt, expected.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(actual, expected);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || "");
  for (const segment of header.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    if (segment.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(segment.slice(separator + 1).trim()); }
      catch { return ""; }
    }
  }
  return "";
}

function cookieValue(token, secure) {
  return COOKIE_NAME + "=" + encodeURIComponent(token) +
    "; Path=/; Max-Age=" + SESSION_TTL_SECONDS +
    "; HttpOnly; SameSite=Lax" + (secure ? "; Secure" : "");
}

function clearedCookie(secure) {
  return COOKIE_NAME + "=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" + (secure ? "; Secure" : "");
}

function cleanPublicUser(row) {
  return { id: row.id, username: row.username, createdAt: row.created_at };
}

function validateState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AccountError(400, "档案数据格式无效。");
  }
  const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded, "utf8") > MAX_STATE_BODY_BYTES) {
    throw new AccountError(413, "档案数据超过安全存储上限，请先导出备份后精简内容。");
  }
  return encoded;
}

function requireSameOrigin(req, trustProxy) {
  const originHeader = req.headers.origin;
  if (!originHeader) throw new AccountError(403, "请求来源校验失败，请刷新网页后重试。");
  let origin;
  try { origin = new URL(originHeader); }
  catch { throw new AccountError(403, "请求来源校验失败。"); }
  const requestHost = String(req.headers.host || "").toLowerCase();
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  const requestProto = trustProxy && forwardedProto
    ? forwardedProto
    : (req.socket.encrypted ? "https" : "http");
  if (origin.host.toLowerCase() !== requestHost || origin.protocol !== requestProto + ":") {
    throw new AccountError(403, "请求来源校验失败，请从 CareerBridge 网站提交。");
  }
}

function consumeAuthLimit(req, routeName, requestIp) {
  const now = Date.now();
  const ip = requestIp(req).slice(0, 100);
  const key = routeName + ":" + ip;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + AUTH_WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > AUTH_LIMITS[routeName]) {
    throw new AccountError(429, "操作次数过多，请稍后再试。");
  }
  if (buckets.size > 5000) {
    for (const [entryKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(entryKey);
    }
  }
}

export function createAccountService(options) {
  const databaseUrl = options.databaseUrl || "";
  const trustProxy = Boolean(options.trustProxy);
  const secureCookies = Boolean(options.production);
  const requestIp = options.requestIp;
  const pool = databaseUrl
    ? new Pool({ connectionString: databaseUrl, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 })
    : null;

  async function requireUser(req) {
    const token = readCookie(req, COOKIE_NAME);
    if (!token || token.length > 200) throw new AccountError(401, "请先登录。");
    const result = await pool.query(
      "SELECT u.id, u.username, u.created_at FROM account_sessions s JOIN account_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW()",
      [sha256(token)]
    );
    if (!result.rowCount) throw new AccountError(401, "登录已过期，请重新登录。");
    return result.rows[0];
  }

  async function createSession(client, userId) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await client.query(
      "INSERT INTO account_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
      [sha256(token), userId, expiresAt]
    );
    return token;
  }

  async function handleRegister(req, res) {
    requireSameOrigin(req, trustProxy);
    consumeAuthLimit(req, "register", requestIp);
    requireJson(req);
    const body = await readJson(req, MAX_STATE_BODY_BYTES + MAX_ACCOUNT_BODY_BYTES);
    const username = normalizeUsername(body.username);
    const password = validatePassword(body.password);
    const stateJson = body.state == null ? "{}" : validateState(body.state);
    const passwordHash = await hashSecret(password);
    const recovery = makeRecoveryCode();
    const recoveryHash = await hashSecret(recovery.raw);
    const client = await pool.connect();
    let token = "";
    let user;
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        "INSERT INTO account_users (id, username, password_hash, recovery_hash) VALUES ($1, $2, $3, $4) RETURNING id, username, created_at",
        [randomUUID(), username, passwordHash, recoveryHash]
      );
      user = inserted.rows[0];
      await client.query(
        "INSERT INTO account_states (user_id, state) VALUES ($1, $2::jsonb)",
        [user.id, stateJson]
      );
      token = await createSession(client, user.id);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") throw new AccountError(409, "这个用户名已被注册，请换一个用户名。");
      throw error;
    } finally {
      client.release();
    }
    json(res, 201, { user: cleanPublicUser(user), recoveryCode: recovery.display }, {
      "Set-Cookie": cookieValue(token, secureCookies)
    });
  }

  async function handleLogin(req, res) {
    requireSameOrigin(req, trustProxy);
    consumeAuthLimit(req, "login", requestIp);
    requireJson(req);
    const body = await readJson(req, MAX_ACCOUNT_BODY_BYTES);
    const username = normalizeUsername(body.username);
    const password = validatePassword(body.password);
    const result = await pool.query(
      "SELECT id, username, password_hash, created_at FROM account_users WHERE username = $1",
      [username]
    );
    const row = result.rows[0];
    const valid = row ? await verifySecret(password, row.password_hash) : false;
    if (!valid) throw new AccountError(401, "用户名或密码不正确。");
    const client = await pool.connect();
    let token;
    try {
      await client.query("BEGIN");
      token = await createSession(client, row.id);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    json(res, 200, { user: cleanPublicUser(row) }, { "Set-Cookie": cookieValue(token, secureCookies) });
  }

  async function handleRecover(req, res) {
    requireSameOrigin(req, trustProxy);
    consumeAuthLimit(req, "recover", requestIp);
    requireJson(req);
    const body = await readJson(req, MAX_ACCOUNT_BODY_BYTES);
    const username = normalizeUsername(body.username);
    const recoveryCode = normalizeRecoveryCode(body.recoveryCode);
    const password = validatePassword(body.password);
    if (!recoveryCode) throw new AccountError(401, "用户名或恢复码不正确。");
    const passwordHash = await hashSecret(password);
    const recovery = makeRecoveryCode();
    const recoveryHash = await hashSecret(recovery.raw);
    const client = await pool.connect();
    let token = "";
    let user;
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "SELECT id, username, recovery_hash, created_at FROM account_users WHERE username = $1 FOR UPDATE",
        [username]
      );
      const row = result.rows[0];
      const valid = row ? await verifySecret(recoveryCode, row.recovery_hash) : false;
      if (!valid) throw new AccountError(401, "用户名或恢复码不正确。");
      await client.query(
        "UPDATE account_users SET password_hash = $1, recovery_hash = $2, updated_at = NOW() WHERE id = $3",
        [passwordHash, recoveryHash, row.id]
      );
      await client.query("DELETE FROM account_sessions WHERE user_id = $1", [row.id]);
      token = await createSession(client, row.id);
      await client.query("COMMIT");
      user = row;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    json(res, 200, { user: cleanPublicUser(user), recoveryCode: recovery.display }, {
      "Set-Cookie": cookieValue(token, secureCookies)
    });
  }

  async function handleLogout(req, res) {
    requireSameOrigin(req, trustProxy);
    if (req.method !== "POST") throw new AccountError(405, "请求方式不支持。");
    requireJson(req);
    await readJson(req, MAX_ACCOUNT_BODY_BYTES);
    const token = readCookie(req, COOKIE_NAME);
    if (token && token.length <= 200) {
      await pool.query("DELETE FROM account_sessions WHERE token_hash = $1", [sha256(token)]);
    }
    json(res, 200, { ok: true }, { "Set-Cookie": clearedCookie(secureCookies) });
  }

  async function handleAccount(req, res) {
    requireSameOrigin(req, trustProxy);
    if (req.method !== "DELETE") throw new AccountError(405, "请求方式不支持。");
    requireJson(req);
    const user = await requireUser(req);
    const body = await readJson(req, MAX_ACCOUNT_BODY_BYTES);
    const password = validatePassword(body.password);
    const result = await pool.query("SELECT password_hash FROM account_users WHERE id = $1", [user.id]);
    if (!result.rowCount || !(await verifySecret(password, result.rows[0].password_hash))) {
      throw new AccountError(401, "密码不正确，账户未删除。");
    }
    await pool.query("DELETE FROM account_users WHERE id = $1", [user.id]);
    json(res, 200, { ok: true }, { "Set-Cookie": clearedCookie(secureCookies) });
  }

  async function handleState(req, res) {
    const user = await requireUser(req);
    if (req.method === "GET") {
      const result = await pool.query("SELECT state, updated_at FROM account_states WHERE user_id = $1", [user.id]);
      return json(res, 200, { state: result.rows[0]?.state ?? null, updatedAt: result.rows[0]?.updated_at ?? null });
    }
    if (req.method !== "PUT") throw new AccountError(405, "请求方式不支持。");
    requireSameOrigin(req, trustProxy);
    requireJson(req);
    const stateJson = await readJson(req, MAX_STATE_BODY_BYTES);
    const encoded = validateState(stateJson);
    const result = await pool.query(
      "INSERT INTO account_states (user_id, state, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW() RETURNING updated_at",
      [user.id, encoded]
    );
    json(res, 200, { ok: true, updatedAt: result.rows[0].updated_at });
  }

  return {
    configured: Boolean(pool),
    async authorizeAI(req) {
      if (!pool) throw new AccountError(503, "Account database is not configured. / 账户数据库尚未配置。");
      requireSameOrigin(req, trustProxy);
      requireJson(req);
      return requireUser(req);
    },
    async readAIState(userId) {
      const result = await pool.query("SELECT state FROM account_states WHERE user_id = $1", [userId]);
      return result.rows[0]?.state || {};
    },
    matches(pathname) {
      return pathname === "/api/me" || pathname === "/api/state" || pathname === "/api/account" || pathname.startsWith("/api/auth/");
    },
    async initialize() {
      if (!pool) return;
      const schema = await readFile(new URL("./migrations/001_accounts.sql", import.meta.url), "utf8");
      await pool.query(schema);
      await pool.query("DELETE FROM account_sessions WHERE expires_at <= NOW()");
    },
    async handle(req, res, pathname) {
      if (!pool) {
        return json(res, 503, { error: "账号数据库尚未配置。请在 Render 为服务设置 DATABASE_URL 后重试。" });
      }
      try {
        if (pathname === "/api/auth/register" && req.method === "POST") return await handleRegister(req, res);
        if (pathname === "/api/auth/login" && req.method === "POST") return await handleLogin(req, res);
        if (pathname === "/api/auth/recover" && req.method === "POST") return await handleRecover(req, res);
        if (pathname === "/api/auth/logout") return await handleLogout(req, res);
        if (pathname === "/api/me" && req.method === "GET") {
          const token = readCookie(req, COOKIE_NAME);
          if (!token || token.length > 200) return json(res, 200, { user: null });
          const result = await pool.query(
            "SELECT u.id, u.username, u.created_at FROM account_sessions s JOIN account_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW()",
            [sha256(token)]
          );
          return json(res, 200, { user: result.rows[0] ? cleanPublicUser(result.rows[0]) : null });
        }
        if (pathname === "/api/state") return await handleState(req, res);
        if (pathname === "/api/account") return await handleAccount(req, res);
        return json(res, 404, { error: "账户接口不存在。" });
      } catch (error) {
        if (error instanceof AccountError) return json(res, error.status, { error: error.publicMessage });
        console.error("[account-api]", pathname, error?.code || "internal-error");
        return json(res, 500, { error: "账户服务暂时异常，请稍后重试。" });
      }
    },
    async close() {
      if (pool) await pool.end();
    }
  };
}
