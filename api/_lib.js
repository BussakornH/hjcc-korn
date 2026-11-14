"use strict";
/* SENTINEL server helpers: account store (Neon Postgres on Vercel, a local file in dev), scrypt passwords,
   signed per-tab session tokens and sign-in rate limits. Files starting with "_" are not exposed as routes by Vercel. */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROLES = ["delegate", "chair", "admin"];
const SESSION_TTL = 12 * 3600;
const SCRYPT = { N: 1 << 15, r: 8, p: 1 };
/* LIMIT_IP is deliberately generous: a whole committee can sit behind one venue wifi address, and a few typos must not lock the room out.
   Brute force on one account is stopped by the two account limits below, so this one only has to catch a single address spraying many usernames.
   LIMIT_ACCT counts wrong passwords per account FROM ONE ADDRESS; LIMIT_ACCT_ALL is the ceiling across every address (brute-force cap).
   Keeping them apart means strangers cannot lock an account out for its owner with a handful of bad guesses. The ceiling itself only stops
   addresses the account has never signed in from (see isKnown), so filling it from many addresses does not keep the owner out either.
   An IPv6 address is counted by its /64 (see ipNet). */
const LIMIT_WINDOW = 15 * 60, LIMIT_IP = 40, LIMIT_ACCT = 10, LIMIT_ACCT_ALL = 60;
const MAX_BODY = 256 * 1024;
const ON_VERCEL = !!process.env.VERCEL;
const DATA_DIR = path.join(__dirname, "..", ".data");

/* ---------- storage ---------- */
/* Neon Postgres when DATABASE_URL is set (Vercel + Neon integration); otherwise a local file, dev only. */
let _pg;
function pg() {
  if (!_pg) {
    const q = require("@neondatabase/serverless").neon(process.env.DATABASE_URL);
    _pg = {
      q: (t, p) => q.query(t, p || []),
      ready: Promise.all([
        q.query("CREATE TABLE IF NOT EXISTS sentinel_accounts (u text PRIMARY KEY, role text NOT NULL, hash text NOT NULL)"),
        q.query("CREATE TABLE IF NOT EXISTS sentinel_rl (k text PRIMARY KEY, n int NOT NULL, exp timestamptz NOT NULL)"),
        q.query("CREATE TABLE IF NOT EXISTS sentinel_removed (id text PRIMARY KEY, removed_by text, removed_at timestamptz NOT NULL DEFAULT now())"),
        q.query("CREATE TABLE IF NOT EXISTS sentinel_kv (k text PRIMARY KEY, v text NOT NULL)"),
        q.query("CREATE TABLE IF NOT EXISTS sentinel_seen (u text PRIMARY KEY, role text NOT NULL, topic text, pg text, at timestamptz NOT NULL DEFAULT now())"),
        q.query("CREATE TABLE IF NOT EXISTS sentinel_alloc2 (u text NOT NULL, topic text NOT NULL, cid text NOT NULL UNIQUE, PRIMARY KEY (u, topic))")
      ]).then(async () => {
        /* one-time bootstrap: SEED_ACCOUNTS = {"user":{"p":"password","role":"admin"}} fills an EMPTY table, then the variable should be deleted */
        if (!process.env.SEED_ACCOUNTS) return;
        if ((await q.query("SELECT 1 FROM sentinel_accounts LIMIT 1")).length) return;
        const seed = JSON.parse(process.env.SEED_ACCOUNTS);
        for (const u of Object.keys(seed)) {
          if (!ROLES.includes(seed[u].role) || !/^[a-z0-9._-]{2,32}$/.test(u.toLowerCase()) || ["__proto__", "constructor", "prototype"].includes(u.toLowerCase())) continue;
          await q.query("INSERT INTO sentinel_accounts (u, role, hash) VALUES ($1, $2, $3) ON CONFLICT (u) DO NOTHING", [u.toLowerCase(), seed[u].role, await hashPassword(String(seed[u].p))]);
        }
      })
    };
  }
  return _pg.ready.then(() => _pg);
}
const WIN = LIMIT_WINDOW + " seconds";
const pgDb = {
  async account(u) { const r = (await (await pg()).q("SELECT role, hash FROM sentinel_accounts WHERE u = $1", [u]))[0]; return r || null; },
  async accounts() { const o = Object.create(null); (await (await pg()).q("SELECT u, role, hash FROM sentinel_accounts")).forEach((r) => (o[r.u] = { role: r.role, hash: r.hash })); return o; },
  async putAccount(u, a) { await (await pg()).q("INSERT INTO sentinel_accounts (u, role, hash) VALUES ($1, $2, $3) ON CONFLICT (u) DO UPDATE SET role = $2, hash = $3", [u, a.role, a.hash]); },
  async delAccount(u) { const c = await pg(); await c.q("DELETE FROM sentinel_alloc2 WHERE u = $1", [u]); await c.q("DELETE FROM sentinel_seen WHERE u = $1", [u]); await c.q("DELETE FROM sentinel_accounts WHERE u = $1", [u]); },
  async beat(u, role, topic, page) { await (await pg()).q("INSERT INTO sentinel_seen (u, role, topic, pg, at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT (u) DO UPDATE SET role = $2, topic = $3, pg = $4, at = now()", [u, role, topic, page]); },
  async seen(sec) { return (await (await pg()).q("SELECT u, role, topic, pg AS page, extract(epoch FROM now() - at)::int AS ago FROM sentinel_seen WHERE at > now() - ($1 || ' seconds')::interval ORDER BY at DESC", [String(sec)])); },
  /* live numbers from Postgres itself; each query is optional so a restricted role still returns the rest */
  async stats() {
    const c = await pg(), one = async (sql) => { try { return (await c.q(sql))[0] || null; } catch (e) { return null; } }, many = async (sql) => { try { return await c.q(sql); } catch (e) { return []; } };
    const [size, conn, st, ver] = await Promise.all([
      one("SELECT pg_database_size(current_database())::float8 AS size"),
      one("SELECT count(*)::int AS total, (count(*) FILTER (WHERE state = 'active'))::int AS active FROM pg_stat_activity WHERE datname = current_database()"),
      one("SELECT xact_commit::float8 AS commits, xact_rollback::float8 AS rollbacks, blks_hit::float8 AS hit, blks_read::float8 AS read, tup_returned::float8 AS returned, tup_inserted::float8 AS inserted, tup_updated::float8 AS updated FROM pg_stat_database WHERE datname = current_database()"),
      one("SELECT version() AS v, extract(epoch FROM now() - pg_postmaster_start_time())::int AS up")
    ]);
    const tables = await many("SELECT relname AS name, n_live_tup::int AS rows, pg_total_relation_size(relid)::float8 AS size FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC");
    return { kind: "postgres", size: size && size.size, conn, st, version: ver && ver.v, up: ver && ver.up, tables };
  },
  async getKv(k) { const r = (await (await pg()).q("SELECT v FROM sentinel_kv WHERE k = $1", [k]))[0]; return r ? JSON.parse(r.v) : null; },
  /* the stored text exactly as written, or null when the key does not exist. casKv writes only if the text is still what the caller read. */
  async getKvRaw(k) { const r = (await (await pg()).q("SELECT v FROM sentinel_kv WHERE k = $1", [k]))[0]; return r ? r.v : null; },
  async casKv(k, oldRaw, v) {
    const c = await pg(), nv = JSON.stringify(v);
    if (oldRaw == null) return (await c.q("INSERT INTO sentinel_kv (k, v) VALUES ($1, $2) ON CONFLICT (k) DO NOTHING RETURNING k", [k, nv])).length > 0;
    return (await c.q("UPDATE sentinel_kv SET v = $3 WHERE k = $1 AND v = $2 RETURNING k", [k, oldRaw, nv])).length > 0;
  },
  async setKv(k, v) { await (await pg()).q("INSERT INTO sentinel_kv (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = $2", [k, JSON.stringify(v)]); },
  /* { username: { t1: charId, t2: charId } }: one character per topic per account */
  async allocs() { const o = {}; (await (await pg()).q("SELECT u, topic, cid FROM sentinel_alloc2")).forEach((r) => ((o[r.u] = o[r.u] || {})[r.topic] = r.cid)); return o; },
  /* false when another account already holds the character */
  async setAlloc(u, topic, ch) {
    const c = await pg();
    if (!ch) { await c.q("DELETE FROM sentinel_alloc2 WHERE u = $1 AND topic = $2", [u, topic]); return true; }
    const t = (await c.q("SELECT u FROM sentinel_alloc2 WHERE cid = $1 AND NOT (u = $2 AND topic = $3)", [ch, u, topic]))[0]; if (t) return false;
    try { await c.q("INSERT INTO sentinel_alloc2 (u, topic, cid) VALUES ($1, $2, $3) ON CONFLICT (u, topic) DO UPDATE SET cid = $3", [u, topic, ch]); }
    catch (e) { if (e && e.code === "23505") return false; throw e; }   /* two requests raced for the same character: the loser gets "taken" */
    return true;
  },
  async fail(k) {
    const r = await (await pg()).q(
      "INSERT INTO sentinel_rl (k, n, exp) VALUES ($1, 1, now() + $2::interval) ON CONFLICT (k) DO UPDATE SET " +
      "n = CASE WHEN sentinel_rl.exp > now() THEN sentinel_rl.n + 1 ELSE 1 END, " +
      "exp = CASE WHEN sentinel_rl.exp > now() THEN sentinel_rl.exp ELSE now() + $2::interval END RETURNING n", [k, WIN]);
    if (Math.random() < 0.02) await (await pg()).q("DELETE FROM sentinel_rl WHERE exp < now()");   /* sweep finished windows now and then so the table cannot grow without end */
    return r[0].n;
  },
  async ttl(k) { const r = (await (await pg()).q("SELECT ceil(extract(epoch FROM exp - now()))::int AS t FROM sentinel_rl WHERE k = $1", [k]))[0]; return Math.max(1, r ? r.t : LIMIT_WINDOW); },
  /* undo one fail(): the attempt it counted was not a wrong guess */
  async give(k) { await (await pg()).q("UPDATE sentinel_rl SET n = GREATEST(n - 1, 0) WHERE k = $1 AND exp > now()", [k]); },
  async clear(k) { await (await pg()).q("DELETE FROM sentinel_rl WHERE k = $1", [k]); },
  async removedLines() { return (await (await pg()).q("SELECT id FROM sentinel_removed")).map((r) => r.id); },
  async removeLine(id, by) { await (await pg()).q("INSERT INTO sentinel_removed (id, removed_by) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", [id, by]); },
  async restoreLines(prefix) { await (await pg()).q("DELETE FROM sentinel_removed WHERE id LIKE $1", [String(prefix).replace(/[\\%_]/g, "\\$&") + "%"]); }
};
const FILE = path.join(DATA_DIR, "store.json");
const fload = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { return { accounts: {}, rl: {} }; } };
const fsave = (s) => { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s)); };
const fileDb = {
  async account(u) { const a = fload().accounts; return Object.prototype.hasOwnProperty.call(a, u) ? a[u] : null; },
  async accounts() { return Object.assign(Object.create(null), fload().accounts); },
  async putAccount(u, a) { const s = fload(); s.accounts[u] = a; fsave(s); },
  async delAccount(u) { const s = fload(); delete s.accounts[u]; if (s.alloc2) delete s.alloc2[u]; if (s.seen) delete s.seen[u]; fsave(s); },
  async beat(u, role, topic, page) { const s = fload(); (s.seen = s.seen || {})[u] = { role, topic, page, at: Date.now() }; fsave(s); },
  async seen(sec) { const s = fload().seen || {}; return Object.keys(s).map((u) => ({ u, role: s[u].role, topic: s[u].topic, page: s[u].page, ago: Math.round((Date.now() - s[u].at) / 1000) })).filter((x) => x.ago <= sec).sort((a, b) => a.ago - b.ago); },
  async stats() { const s = fload(); let size = 0; try { size = fs.statSync(FILE).size; } catch (e) { /* no file yet */ } return { kind: "file", size, tables: [["accounts", Object.keys(s.accounts || {}).length], ["settings", Object.keys(s.kv || {}).length], ["allocations", Object.keys(s.alloc2 || {}).length]].map(([name, rows]) => ({ name, rows, size: null })) }; },
  async getKv(k) { return (fload().kv || {})[k] || null; },
  async getKvRaw(k) { const kv = fload().kv || {}; return Object.prototype.hasOwnProperty.call(kv, k) ? JSON.stringify(kv[k]) : null; },
  async casKv(k, oldRaw, v) {
    const s = fload(), kv = s.kv || {}, cur = Object.prototype.hasOwnProperty.call(kv, k) ? JSON.stringify(kv[k]) : null;
    if (cur !== oldRaw) return false;
    (s.kv = kv)[k] = v; fsave(s); return true;
  },
  async setKv(k, v) { const s = fload(); (s.kv = s.kv || {})[k] = v; fsave(s); },
  async allocs() { const a = fload().alloc2 || {}, o = {}; Object.keys(a).forEach((u) => (o[u] = Object.assign({}, a[u]))); return o; },
  async setAlloc(u, topic, ch) {
    const s = fload(); s.alloc2 = s.alloc2 || {};
    if (!ch) { if (s.alloc2[u]) delete s.alloc2[u][topic]; fsave(s); return true; }
    if (Object.keys(s.alloc2).some((k) => Object.keys(s.alloc2[k]).some((t) => s.alloc2[k][t] === ch && !(k === u && t === topic)))) return false;
    (s.alloc2[u] = s.alloc2[u] || {})[topic] = ch; fsave(s); return true;
  },
  async fail(k) { const s = fload(), r = s.rl[k]; s.rl[k] = r && r.exp > Date.now() ? { n: r.n + 1, exp: r.exp } : { n: 1, exp: Date.now() + LIMIT_WINDOW * 1000 }; fsave(s); return s.rl[k].n; },
  async ttl(k) { const r = fload().rl[k]; return Math.max(1, r ? Math.ceil((r.exp - Date.now()) / 1000) : LIMIT_WINDOW); },
  async give(k) { const s = fload(), r = s.rl[k]; if (r && r.exp > Date.now()) { r.n = Math.max(0, r.n - 1); fsave(s); } },
  async clear(k) { const s = fload(); delete s.rl[k]; fsave(s); },
  async removedLines() { return Object.keys(fload().removed || {}); },
  async removeLine(id, by) { const s = fload(); (s.removed = s.removed || {})[id] = { by, at: Date.now() }; fsave(s); },
  async restoreLines(prefix) { const s = fload(); Object.keys(s.removed || {}).forEach((id) => { if (id.indexOf(prefix) === 0) delete s.removed[id]; }); fsave(s); }
};
/* Dev only: DEV_DB_LATENCY=15 delays every file-store call by up to 15 ms either side, so a read-then-write has a gap in it like it does on
   a network database. Without it the file store is too fast to show the races the Postgres store has. */
const LAG = +process.env.DEV_DB_LATENCY || 0, nap = () => new Promise((r) => setTimeout(r, Math.random() * LAG));
const lagged = (f) => (LAG && typeof f === "function" ? async (...a) => { await nap(); const out = await f(...a); await nap(); return out; } : f);
const db = new Proxy({}, {
  get(_, name) {
    if (process.env.DATABASE_URL) return pgDb[name];
    if (!ON_VERCEL) return lagged(fileDb[name]);
    return () => { throw new Error("database is not configured (connect a Neon database to this Vercel project)"); };
  }
});

/* ---------- passwords ---------- */
function scrypt(pw, salt, N, r, p) {
  return new Promise((res, rej) => crypto.scrypt(pw, salt, 32, { N, r, p, maxmem: 256 * N * r }, (e, k) => (e ? rej(e) : res(k))));
}
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16), { N, r, p } = SCRYPT, k = await scrypt(pw, salt, N, r, p);
  return ["scrypt", N, r, p, salt.toString("base64"), k.toString("base64")].join("$");
}
async function verifyPassword(pw, stored) {
  const [, N, r, p, s, h] = stored.split("$"), k = await scrypt(pw, Buffer.from(s, "base64"), +N, +r, +p), want = Buffer.from(h, "base64");
  return k.length === want.length && crypto.timingSafeEqual(k, want);
}
/* "password" (wrong length), "password-common" (on the list, one repeated character, or the username), or null when it will do */
const PW_MIN = 10;
const PW_COMMON = new Set(["1234567890", "0123456789", "12345678910", "123456789a", "a123456789", "qwertyuiop", "1q2w3e4r5t", "1qaz2wsx3edc", "qwerty1234", "qwerty12345",
  "password12", "password123", "password1234", "passw0rd123", "iloveyou12", "administrator", "letmein123", "welcome123", "changeme123", "abcdefghij", "abc1234567",
  "sentinel123", "sentinel2026", "hjcc123456", "hjcc2026", "chair12345", "delegate123", "admin12345", "admin123456"]);
function passwordProblem(p, u) {
  p = String(p); const lc = p.toLowerCase();
  if (p.length < PW_MIN || p.length > 200) return "password";
  if (PW_COMMON.has(lc) || /^(.)\1+$/.test(p) || (u && (lc === u || (u.length >= 4 && lc.includes(u))))) return "password-common";
  return null;
}
let _dummy;
const dummyHash = () => (_dummy = _dummy || hashPassword("sentinel-dummy"));

/* ---------- sessions ---------- */
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (ON_VERCEL) throw new Error("SESSION_SECRET is not set");
  const f = path.join(DATA_DIR, "secret");
  try { return fs.readFileSync(f, "utf8"); } catch (e) {
    const s = crypto.randomBytes(32).toString("hex"); fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(f, s); return s;
  }
}
const sign = (body) => crypto.createHmac("sha256", secret()).update(body).digest("base64url");
/* A token is tied to the account's current password hash: resetting the password, or deleting and recreating the account
   (new random salt), makes every earlier token stop working. */
const fingerprint = (hash) => crypto.createHash("sha256").update(String(hash)).digest("base64url").slice(0, 16);
function makeToken(u, role, hash) {
  const body = Buffer.from(JSON.stringify({ u, role, f: fingerprint(hash), exp: Math.floor(Date.now() / 1000) + SESSION_TTL })).toString("base64url");
  return body + "." + sign(body);
}
/* verified session that still matches a live account, or null */
async function session(req) {
  const h = String(req.headers.authorization || ""), t = h.slice(0, 7) === "Bearer " ? h.slice(7).trim() : "";
  if (!t) return null;
  const [body, sig, extra] = t.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const want = Buffer.from(sign(body)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  let s; try { s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch (e) { return null; }
  if (!s || !(s.exp >= Date.now() / 1000)) return null;   /* a token with no expiry is refused too */
  const a = await db.account(s.u);
  return a && a.role === s.role && s.f === fingerprint(a.hash) ? { u: s.u, role: a.role } : null;
}
/* ---------- http ---------- */
function send(res, status, obj, headers) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const k in headers || {}) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(obj));
}
/* A short tag that changes whenever the stored text for a key changes ("0" while it does not exist). Clients send back the tag they last saw. */
const verOf = (raw) => (raw == null ? "0" : crypto.createHash("sha1").update(raw).digest("base64url").slice(0, 12));
/* Read-modify-write that cannot lose another request's change: fn(current) returns the new value, or undefined to leave it alone.
   If someone else wrote in between, the write is refused and fn runs again on what they wrote. */
async function updateKv(k, fn, tries) {
  for (let i = 0; i < (tries || 15); i++) {
    const raw = await db.getKvRaw(k), cur = raw == null ? null : JSON.parse(raw), next = await fn(cur);
    if (next === undefined) return cur;
    if (await db.casKv(k, raw, next)) return next;
    await new Promise((r) => setTimeout(r, Math.random() * 6 * (i + 1)));   /* lost the race: wait a random moment so the losers do not all collide again */
  }
  throw Object.assign(new Error("busy"), { status: 503, error: "busy" });
}
const tooBig = () => Object.assign(new Error("payload too large"), { status: 413, error: "too-large" });
/* Every route reads fields off the result, so anything that is not a JSON object (null, a number, a string, an array) comes back as {}. */
const asObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
async function readJson(req, max) {
  max = max || MAX_BODY;
  if (Number(req.headers["content-length"]) > max) throw tooBig();   /* also covers Vercel, which hands us req.body already parsed */
  if (req.body && typeof req.body === "object") return asObj(req.body);
  if (typeof req.body === "string") { if (req.body.length > max) throw tooBig(); try { return asObj(JSON.parse(req.body)); } catch (e) { return {}; } }
  let n = 0; const chunks = [];
  for await (const c of req) { n += c.length; if (n > max) throw tooBig(); chunks.push(c); }
  try { return asObj(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (e) { return {}; }
}
function sameOrigin(req) {
  try { return new URL(req.headers.origin).host === req.headers.host; } catch (e) { return false; }
}
/* The caller's address. On Vercel the platform writes these headers itself, so they can be believed. Anywhere else a client can type whatever it
   likes into them, so only the socket address counts unless TRUST_PROXY=1 says a proxy we run sets them. */
function clientIp(req) {
  const h = req.headers, sock = (req.socket && req.socket.remoteAddress) || "?";
  const fwd = ON_VERCEL || process.env.TRUST_PROXY === "1" ? h["x-vercel-forwarded-for"] || h["x-real-ip"] || String(h["x-forwarded-for"] || "").split(",")[0] : "";
  return String(fwd || sock).trim().slice(0, 64);
}
/* What the sign-in limits count an address as. One IPv6 customer is handed a whole /64 (18 quintillion addresses), so counting each address on
   its own lets them start a fresh count whenever they like: IPv6 is counted by its /64. IPv4 (also when written ::ffff:1.2.3.4) is counted as it is. */
function ipNet(ip) {
  ip = String(ip).toLowerCase().replace(/%.*$/, "").slice(0, 64);
  const v4 = ip.match(/^(?:::ffff:)?(\d+\.\d+\.\d+\.\d+)$/); if (v4) return v4[1];
  if (!ip.includes(":")) return ip;
  const [h, t] = ip.split("::"), head = h ? h.split(":") : [], tail = t ? t.split(":") : [];
  const full = t === undefined ? head : head.concat(Array(Math.max(0, 8 - head.length - tail.length)).fill("0"), tail);
  return full.slice(0, 4).map((x) => (parseInt(x, 16) || 0).toString(16)).join(":") + "::/64";
}
/* Addresses an account has signed in from before, kept as short hashes (newest last, at most KNOWN_MAX). The overall wrong-password ceiling does
   not apply to them, so strangers filling that ceiling from many addresses cannot keep the real owner out. */
const KNOWN_MAX = 64, knownTag = (acctKey, net) => crypto.createHash("sha256").update(acctKey + "|" + net).digest("base64url").slice(0, 16);
async function isKnown(acctKey, net) { const l = await db.getKv("known:" + acctKey); return Array.isArray(l) && l.includes(knownTag(acctKey, net)); }
async function addKnown(acctKey, net) {
  const tag = knownTag(acctKey, net);
  await updateKv("known:" + acctKey, (cur) => { const l = Array.isArray(cur) ? cur : []; return l.includes(tag) ? undefined : l.concat(tag).slice(-KNOWN_MAX); });
}
const forgetKnown = (acctKey) => db.setKv("known:" + acctKey, null);
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (e && e.status) return send(res, e.status, { error: e.error || "server" });
    console.error(e); send(res, 500, { error: "server" });
  }
};

module.exports = { ROLES, LIMIT_IP, LIMIT_ACCT, LIMIT_ACCT_ALL, PW_MIN, db, hashPassword, verifyPassword, passwordProblem, dummyHash, makeToken, session, send, readJson, sameOrigin, clientIp, ipNet, isKnown, addKnown, forgetKnown, wrap, SESSION_TTL, verOf, updateKv };
