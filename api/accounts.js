"use strict";
const L = require("./_lib");

/* Administrator only.
   GET                      -> [{ u, role }]
   POST { u, p, role }      -> create the account, or reset its password / access level
   DELETE { u }             -> remove it (not your own account, never the last administrator) */
module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me || me.role !== "admin") return L.send(res, 403, { error: "forbidden" });
  if (req.method === "GET") {
    const all = await L.db.accounts();
    return L.send(res, 200, Object.keys(all).sort().map((u) => ({ u, role: all[u].role })));
  }
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  const b = await L.readJson(req), u = String(b.u || "").trim().toLowerCase();
  if (req.method === "POST") {
    const p = String(b.p || ""), role = String(b.role || "");
    if (!/^[a-z0-9._-]{2,32}$/.test(u)) return L.send(res, 400, { error: "username" });
    if (!L.ROLES.includes(role)) return L.send(res, 400, { error: "role" });
    if (p.length < 6 || p.length > 200) return L.send(res, 400, { error: "password" });
    await L.db.putAccount(u, { role, hash: await L.hashPassword(p) });
    return L.send(res, 200, { u, role });
  }
  if (req.method === "DELETE") {
    const all = await L.db.accounts();
    if (!all[u]) return L.send(res, 404, { error: "missing" });
    if (u === me.u) return L.send(res, 400, { error: "self" });
    if (all[u].role === "admin" && Object.values(all).filter((a) => a.role === "admin").length < 2) return L.send(res, 400, { error: "last-admin" });
    await L.db.delAccount(u);
    return L.send(res, 200, { ok: true });
  }
  L.send(res, 405, { error: "method" });
});
