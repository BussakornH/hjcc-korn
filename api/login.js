"use strict";
const L = require("./_lib");

/* POST { u, p, role } -> 200 { u, role, token } | 401 bad | 403 role | 429 locked.
   The administrator form sends no username: the password is tried against admin accounts only. */
module.exports = L.wrap(async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, { error: "method" });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  const b = await L.readJson(req, 4096);
  const role = String(b.role || ""), p = String(b.p || ""), u = String(b.u || "").trim().toLowerCase();
  if (!L.ROLES.includes(role) || !p || p.length > 200 || u.length > 40) return L.send(res, 400, { error: "bad" });

  const accounts = await L.db.accounts();
  const wanted = role === "admin" ? null : accounts[u] || null;
  /* one bucket per account; every admin account shares one so the admin form and the username form cannot double the guesses */
  const acctKey = role === "admin" || (wanted && wanted.role === "admin") ? "acct:*admin" : "acct:" + u;
  const ip = L.clientIp(req), ipKey = "ip:" + ip;
  /* Wrong guesses are counted three ways: per address, per account FROM that address, and per account overall.
     Only the first two lock quickly, so a stranger's bad guesses from other addresses cannot lock the real owner out;
     the overall count is a high ceiling that still caps brute force spread over many addresses. */
  const pairKey = acctKey + "|" + ip;

  const [ipN, pairN, acctN] = await Promise.all([L.db.count(ipKey), L.db.count(pairKey), L.db.count(acctKey)]);
  if (ipN >= L.LIMIT_IP || pairN >= L.LIMIT_ACCT || acctN >= L.LIMIT_ACCT_ALL) {
    const lockedKey = ipN >= L.LIMIT_IP ? ipKey : pairN >= L.LIMIT_ACCT ? pairKey : acctKey;
    const retry = await L.db.ttl(lockedKey);
    return L.send(res, 429, { error: "locked", retry }, { "Retry-After": String(retry) });
  }

  let hit = null;
  const pool = role === "admin" ? Object.entries(accounts).filter(([, a]) => a.role === "admin") : wanted ? [[u, wanted]] : [];
  for (const [name, a] of pool) if (!hit && (await L.verifyPassword(p, a.hash))) hit = { u: name, role: a.role, hash: a.hash };
  if (!pool.length) await L.verifyPassword(p, await L.dummyHash()); /* unknown name costs the same time as a real one */

  if (!hit) {
    await Promise.all([L.db.fail(ipKey), L.db.fail(pairKey), L.db.fail(acctKey)]);
    return L.send(res, 401, { error: "bad" });
  }
  if (hit.role !== role) return L.send(res, 403, { error: "role" });
  await Promise.all([L.db.clear(ipKey), L.db.clear(pairKey)]);
  L.send(res, 200, { u: hit.u, role: hit.role, token: L.makeToken(hit.u, hit.role, hit.hash) });
});
