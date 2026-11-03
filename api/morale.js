"use strict";
const L = require("./_lib");
const CHARS = require("./_chars");

/* Morale is set by the chairs, one figure per side per topic (0 to 100, 50 until they change it). Delegates only ever see their own side's.
   GET                          -> admin / chair: { t1: { me, foe }, t2: { me, foe } }
                                   delegate:      { mine: { t1: number | null, t2: number | null } }   (null while the delegate is on no side)
   POST { topic, side, value }  -> set one side's morale                (admin, chair) */
const TOPIC = ["t1", "t2"], DEF = 50;
const load = async (t) => { const m = (await L.db.getKv("morale:" + t)) || {}; return { me: Number.isFinite(m.me) ? m.me : DEF, foe: Number.isFinite(m.foe) ? m.foe : DEF }; };
/* the side a delegate's character is on today: "me", "foe" or "ne" (the same days the Sides page keeps) */
async function sideOf(user, t) {
  const own = (await L.db.allocs())[user] || {}, ch = CHARS.find((c) => c.id === own[t]); if (!ch) return "ne";
  const days = (await L.db.getKv("days:" + t)) || { days: [{ n: 1, sides: Object.fromEntries(CHARS.filter((c) => c.topic === t).map((c) => [c.id, c.side || "ne"])) }] };
  return days.days[days.days.length - 1].sides[ch.id] || "ne";
}
module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me) return L.send(res, 401, { error: "auth" });
  const staff = me.role === "admin" || me.role === "chair";
  if (req.method === "GET") {
    if (staff) { const out = {}; for (const t of TOPIC) out[t] = await load(t); return L.send(res, 200, out); }
    const mine = {};
    for (const t of TOPIC) { const s = await sideOf(me.u, t); mine[t] = s === "me" || s === "foe" ? (await load(t))[s] : null; }
    return L.send(res, 200, { mine });
  }
  if (!staff) return L.send(res, 403, { error: "forbidden" });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  if (req.method !== "POST") return L.send(res, 405, { error: "method" });
  const b = await L.readJson(req), t = String(b.topic || ""), s = String(b.side || ""), v = Number(b.value);
  if (!TOPIC.includes(t) || (s !== "me" && s !== "foe") || !Number.isFinite(v)) return L.send(res, 400, { error: "morale" });
  const value = Math.min(100, Math.max(0, Math.round(v * 100) / 100));
  /* runs on the freshest stored state, so two chairs setting different sides at once both land */
  await L.updateKv("morale:" + t, (cur) => { const m = cur || {}; m[s] = value; return m; });
  L.send(res, 200, Object.assign({ ok: true }, await load(t)));
});
