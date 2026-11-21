"use strict";
const L = require("./_lib");

/* The combat rules of a topic (damage formula, switches, the three tables, directives), shared by every screen so the Admin's and the chairs'
   edits reach every calculator. Until someone saves them a topic has none here and each device keeps using its own.
   GET                          -> { t1: rules | null, t2: rules | null, ver: { t1, t2 } }     (any signed-in role)
   POST { topic, rules, base }  -> replace the topic's rules                                    (admin, chair)
        base is the ver the caller last saw. If the rules have changed since, nothing is written and the answer is
        409 { error: "stale", ver, rules: <the current rules> }, so a device that was asleep cannot put old rules back.
        200 { ok, ver, rules } carries the new ver and the rules as stored.
   Sub classes and their stats are not part of this: they stay on each device. */
const TOPIC = ["t1", "t2"], BOOL = ["useMorale", "useMult", "useBonus", "useStr", "useMod", "useChart", "useCounter", "autoLost"];
const SPREAD = ["focus", "even", "prop"], ROUND = ["none", "round", "floor", "ceil"], MAX_ROWS = 40;
const n = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : 0; };
const txt = (v, k) => String(v == null ? "" : v).slice(0, k);
const rows = (v, fn) => (Array.isArray(v) ? v.slice(0, MAX_ROWS).filter((r) => r && typeof r === "object").map(fn) : []);
function clean(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const out = { expr: txt(r.expr, 300) };   /* an empty or broken formula is kept as typed: every page falls back to the standard one and says so */
  BOOL.forEach((k) => (out[k] = !!r[k]));
  out.str = rows(r.str, (x) => (x.noAtk ? { upTo: n(x.upTo, 0, 100), noAtk: true, atk: 0 } : { upTo: n(x.upTo, 0, 100), atk: n(x.atk, -1000, 1000) }));
  out.mod = rows(r.mod, (x) => ({ min: n(x.min, 0, 100), mod: n(x.mod, -1000, 1000) }));
  out.chart = rows(r.chart, (x) => ({ min: n(x.min, 0, 100000), tDmg: n(x.tDmg, 0, 100000), aLoss: n(x.aLoss, 0, 100), note: txt(x.note, 120) }));
  out.spread = SPREAD.includes(r.spread) ? r.spread : "focus";
  out.rounding = ROUND.includes(r.rounding) ? r.rounding : "none";
  const dir = (v) => rows(v, (x) => ({ t: txt(x.t, 40) || "*", atk: n(x.atk, -1000, 1000), note: txt(x.note, 120) }));
  out.dir = { me: dir(r.dir && r.dir.me), foe: dir(r.dir && r.dir.foe) };
  /* the counter-attack of a defender the attack destroyed (% of its attack), and trenches: % less damage for a unit in its side's trench, and how near (km) counts as in it */
  out.deadCounter = r.deadCounter == null ? 50 : n(r.deadCounter, 0, 100);
  out.trenchCut = r.trenchCut == null ? 50 : n(r.trenchCut, 0, 100);
  out.trenchKm = r.trenchKm == null ? 10 : n(r.trenchKm, 1, 300);
  out.trenchKm10 = !!r.trenchKm10;   /* the move from the old 30 km default to 10 km has been made (app.js rulesAdopt) */
  return out;
}
module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me) return L.send(res, 401, { error: "auth" });
  if (req.method === "GET") {
    const out = { ver: {} };
    for (const t of TOPIC) { const raw = await L.db.getKvRaw("rules:" + t); out[t] = (raw && JSON.parse(raw)) || null; out.ver[t] = L.verOf(raw); }
    return L.send(res, 200, out);
  }
  if (me.role !== "admin" && me.role !== "chair") return L.send(res, 403, { error: "forbidden" });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  if (req.method !== "POST") return L.send(res, 405, { error: "method" });
  const b = await L.readJson(req, 32 * 1024), t = String(b.topic || "");
  if (!TOPIC.includes(t)) return L.send(res, 400, { error: "topic" });
  const rules = clean(b.rules); if (!rules) return L.send(res, 400, { error: "rules" });
  const key = "rules:" + t, stale = (raw) => L.send(res, 409, { error: "stale", ver: L.verOf(raw), rules: (raw && JSON.parse(raw)) || null });
  const raw = await L.db.getKvRaw(key);
  if (String(b.base == null ? "" : b.base) !== L.verOf(raw)) return stale(raw);
  if (!(await L.db.casKv(key, raw, rules))) return stale(await L.db.getKvRaw(key));   /* someone saved between our read and our write */
  L.send(res, 200, { ok: true, ver: L.verOf(JSON.stringify(rules)), rules });
});
