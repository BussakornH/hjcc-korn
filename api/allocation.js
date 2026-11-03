"use strict";
const L = require("./_lib");
const CHARS = require("./_chars");

/* GET                      -> { chars, mine }                     (any signed-in role)
                               + { assigned: { username: id } }    (admin)
   POST { u, topic, char }  -> give an account its character for a topic (one per topic), or clear it with char = null   (admin) */
module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me) return L.send(res, 401, { error: "auth" });
  const all = await L.db.allocs();
  if (req.method === "GET") {
    const out = { chars: CHARS, mine: all[me.u] || {} };
    if (me.role === "admin") out.assigned = all;
    return L.send(res, 200, out);
  }
  if (me.role !== "admin") return L.send(res, 403, { error: "forbidden" });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  if (req.method !== "POST") return L.send(res, 405, { error: "method" });
  const b = await L.readJson(req), u = String(b.u || "").trim().toLowerCase(), ch = b.char == null || b.char === "" ? null : String(b.char);
  const acct = await L.db.account(u);
  if (!acct || acct.role !== "delegate") return L.send(res, 404, { error: "missing" });
  const t = String(b.topic || "");
  if (!["t1", "t2"].includes(t) || (ch && !CHARS.some((c) => c.id === ch && c.topic === t))) return L.send(res, 400, { error: "char" });
  if (!(await L.db.setAlloc(u, t, ch))) return L.send(res, 409, { error: "taken" });
  L.send(res, 200, { u, topic: t, char: ch });
});
