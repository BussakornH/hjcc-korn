"use strict";
const L = require("./_lib");

/* POST { u, p, role } -> 200 { u, role, token } | 401 bad | 403 role | 429 locked.
   The administrator form sends no username: the password is tried against admin accounts only. */
module.exports = L.wrap(async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, { error: "method" });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  const b = await L.readJson(req);
  const role = String(b.role || ""), p = String(b.p || ""), u = String(b.u || "").trim().toLowerCase();
  if (!L.ROLES.includes(role) || !p || p.length > 200 || u.length > 40) return L.send(res, 400, { error: "bad" });

  const accounts = await L.db.accounts();
  const wanted = role === "admin" ? null : accounts[u] || null;
  /* one bucket per account; every admin account shares one so the admin form and the username form cannot double the guesses */
  const acctKey = role === "admin" || (wanted && wanted.role === "admin") ? "acct:*admin" : "acct:" + u;
  const ipKey = "ip:" + L.clientIp(req);

  const [ipN, acctN] = await Promise.all([L.db.count(ipKey), L.db.count(acctKey)]);
  if (ipN >= L.LIMIT_IP || acctN >= L.LIMIT_ACCT) {
    const retry = await L.db.ttl(ipN >= L.LIMIT_IP ? ipKey : acctKey);
    return L.send(res, 429, { error: "locked", retry }, { "Retry-After": String(retry) });
  }

  let hit = null;
  const pool = role === "admin" ? Object.entries(accounts).filter(([, a]) => a.role === "admin") : wanted ? [[u, wanted]] : [];
  for (const [name, a] of pool) if (!hit && (await L.verifyPassword(p, a.hash))) hit = { u: name, role: a.role };
  if (!pool.length) await L.verifyPassword(p, await L.dummyHash()); /* unknown name costs the same time as a real one */

  if (!hit) {
    await Promise.all([L.db.fail(ipKey), L.db.fail(acctKey)]);
    return L.send(res, 401, { error: "bad" });
  }
  if (hit.role !== role) return L.send(res, 403, { error: "role" });
  await L.db.clear(ipKey);
  L.send(res, 200, { u: hit.u, role: hit.role, token: L.makeToken(hit.u, hit.role) });
});
