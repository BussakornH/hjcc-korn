"use strict";
const L = require("./_lib");

/* POST { scope: "t1" | "t2" | "all" }  -> wipe everything shared for the topic(s): troops on the map, the delegates' copied forces, battle lines, weak / fortified points, city sides, sides by day, morale.
   It also stamps a new "epoch"; every browser that sees a new epoch clears its own forces for that topic the next time it loads.   (admin) */
module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me) return L.send(res, 401, { error: "auth" });
  if (me.role !== "admin") return L.send(res, 403, { error: "forbidden" });
  if (req.method !== "POST") return L.send(res, 405, { error: "method" });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  const b = await L.readJson(req), scope = String(b.scope || ""), topics = scope === "all" ? ["t1", "t2"] : ["t1", "t2"].filter((t) => t === scope);
  if (!topics.length) return L.send(res, 400, { error: "scope" });
  const users = Object.keys(await L.db.accounts()), stamp = Date.now();
  for (const t of topics) {
    for (const k of ["troops:" + t, "lines:" + t, "points:" + t, "citysides:" + t, "days:" + t, "morale:" + t]) await L.db.setKv(k, null);
    for (const u of users) await L.db.setKv("forces:" + t + ":" + u, null);
    await L.db.setKv("epoch:" + t, stamp);
  }
  L.send(res, 200, { ok: true, topics });
});
