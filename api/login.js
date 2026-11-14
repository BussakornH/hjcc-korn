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
  /* One bucket per account. The administrator form has no username, so every admin account shares the "*admin" bucket for it.
     A username sign-in is always limited by that username's own bucket, whatever the account's level: if an admin's name answered from the
     shared bucket instead, a locked "*admin" bucket would tell a stranger which usernames are administrators. Guesses at an admin's name are
     still ADDED to the shared bucket (extra), so the two forms together get far fewer guesses than two separate limits would give. */
  const acctKey = role === "admin" ? "acct:*admin" : "acct:" + u;
  const net = L.ipNet(L.clientIp(req)), ipKey = "ip:" + net;
  /* Wrong guesses are counted three ways: per address, per account FROM that address, and per account overall.
     The first two lock quickly. The overall count is a ceiling on brute force spread over many addresses, and it only refuses addresses the
     account has never signed in from: otherwise anyone could fill it from a handful of addresses and keep the real owner (or every
     administrator at once) out for as long as they liked. */
  const pairKey = acctKey + "|" + net;
  const extra = role !== "admin" && wanted && wanted.role === "admin" ? ["acct:*admin|" + net, "acct:*admin"] : [];

  /* Every attempt is counted BEFORE the password is checked, and handed back if it turns out not to be a wrong guess. Counting after the
     (slow) check let a burst of parallel requests all read the old count and all be checked. */
  const keys = [ipKey, pairKey, acctKey], giveBack = () => Promise.all(keys.concat(extra).map((k) => L.db.give(k)));
  const [ipN, pairN, acctN] = await Promise.all(keys.concat(extra).map((k) => L.db.fail(k)));
  const overAll = acctN > L.LIMIT_ACCT_ALL && !(await L.isKnown(acctKey, net));
  if (ipN > L.LIMIT_IP || pairN > L.LIMIT_ACCT || overAll) {
    const lockedKey = ipN > L.LIMIT_IP ? ipKey : pairN > L.LIMIT_ACCT ? pairKey : acctKey;
    await giveBack();   /* a refused attempt is not a guess */
    const retry = await L.db.ttl(lockedKey);
    return L.send(res, 429, { error: "locked", retry }, { "Retry-After": String(retry) });
  }

  let hit = null;
  const pool = role === "admin" ? Object.entries(accounts).filter(([, a]) => a.role === "admin") : wanted ? [[u, wanted]] : [];
  for (const [name, a] of pool) if (!hit && (await L.verifyPassword(p, a.hash))) hit = { u: name, role: a.role, hash: a.hash };
  if (!pool.length) await L.verifyPassword(p, await L.dummyHash()); /* unknown name costs the same time as a real one */

  if (!hit) return L.send(res, 401, { error: "bad" });   /* the wrong guess stays counted */
  if (hit.role !== role) { await giveBack(); return L.send(res, 403, { error: "role" }); }
  /* the account's overall count only gets this attempt back, so many tabs signing in to one shared account never lock it */
  await Promise.all([L.db.clear(ipKey), L.db.clear(pairKey), L.db.give(acctKey), L.addKnown(acctKey, net)]);
  L.send(res, 200, { u: hit.u, role: hit.role, token: L.makeToken(hit.u, hit.role, hit.hash) });
});
