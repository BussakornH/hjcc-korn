"use strict";
const L = require("./_lib");
const CHARS = require("./_chars");

/* The units each chair keeps in their own browser, copied up so the other chairs see them too (read only for them).
   GET                      -> { t1: [{ user, side, units }], t2: [...] }     (admin, chair)
                               a chair's entry has side null and each unit carries its own side; an entry left by a former delegate account has the side
                               of that delegate's character today ("me", "foe" or "ne")
   POST { topic, units }    -> replace the signed-in chair's units for the topic     (chair)
   unit: { id, name, code, cls, branch, side, hp, maxhp, atk, mov, rng, fr } (side: "me" | "foe" | "ne"; fr: "reserve" | "front" | "lost") */
const TOPIC = ["t1", "t2"], MAX = 300;
const n = (v, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(0, Math.round(v * 100) / 100)) : null; };
const id = (v, k) => String(v || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, k);
const clean = (v) => {
  if (!Array.isArray(v) || v.length > MAX) return null;
  const seen = new Set(), out = [];
  for (const x of v) {
    const uid = id(x && x.id, 24), name = String((x && x.name) || "").trim().slice(0, 50), hp = n(x && x.hp, 100000), maxhp = n(x && x.maxhp, 100000);
    if (!uid || seen.has(uid) || !name || hp === null || maxhp === null) return null;
    seen.add(uid);
    out.push({ id: uid, name, code: id(x.code, 8), cls: String(x.cls || "").slice(0, 40), branch: id(x.branch, 24), side: x.side === "foe" || x.side === "ne" ? x.side : "me", hp, maxhp, atk: n(x.atk, 1000) || 0, mov: n(x.mov, 1000) || 0, rng: n(x.rng, 1000) || 0, fr: x.fr === "reserve" || x.fr === "lost" ? x.fr : "front" });
  }
  return out;
};
async function sideOf(user, t, allocs) {
  const own = (allocs[user] || {})[t], ch = CHARS.find((c) => c.id === own); if (!ch) return "ne";
  const days = (await L.db.getKv("days:" + t)) || { days: [{ n: 1, sides: Object.fromEntries(CHARS.filter((c) => c.topic === t).map((c) => [c.id, c.side || "ne"])) }] };
  return days.days[days.days.length - 1].sides[ch.id] || "ne";
}
module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me) return L.send(res, 401, { error: "auth" });
  if (req.method === "GET") {
    if (me.role !== "admin" && me.role !== "chair") return L.send(res, 403, { error: "forbidden" });
    const allocs = await L.db.allocs(), accts = await L.db.accounts(), out = { t1: [], t2: [] };
    for (const u of Object.keys(accts)) if (accts[u].role === "chair") for (const t of TOPIC) {
      const units = await L.db.getKv("forces:" + t + ":" + u); if (units && units.length) out[t].push({ user: u, side: null, units });
    }
    for (const u of Object.keys(allocs)) if (!accts[u] || accts[u].role !== "chair") for (const t of TOPIC) {
      if (!allocs[u][t]) continue; const side = await sideOf(u, t, allocs); if (side === "ne" && !(await L.db.getKv("forces:" + t + ":" + u))) continue;
      const units = await L.db.getKv("forces:" + t + ":" + u); if (units && units.length) out[t].push({ user: u, side, units });
    }
    return L.send(res, 200, out);
  }
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  if (req.method !== "POST") return L.send(res, 405, { error: "method" });
  if (me.role !== "chair") return L.send(res, 403, { error: "forbidden" });
  const b = await L.readJson(req), t = String(b.topic || "");
  if (!TOPIC.includes(t)) return L.send(res, 400, { error: "topic" });
  const units = clean(b.units); if (!units) return L.send(res, 400, { error: "units" });
  await L.db.setKv("forces:" + t + ":" + me.u, units);
  L.send(res, 200, { ok: true });
});
