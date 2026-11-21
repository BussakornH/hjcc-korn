"use strict";
const L = require("./_lib");
const DEFAULTS = require("./_lines");

/* Battle lines, one list per topic, shared by every screen. Until a chair changes a topic it shows the defaults.
   GET                              -> { canEdit, t1: [{ id, name, pts }], t2: [...] }   (any signed-in role; pts are [lat, lon])
   POST { topic, lines }            -> replace the topic's lines (add, remove and reshape in one go)   (admin, chair)
   POST { topic, reset: true }      -> go back to the default lines                                    (admin, chair)
   POST { topic, citySide: { name, side } } -> give a city to a side: "me" | "foe" | "n", or "default" to clear   (admin, chair)
   POST { topic, points }           -> replace the topic's weak / fortified points (admin, chair)
   GET also returns points: { t1: [{ id, kind: "weak"|"fort", lat, lon, r (km), name }], t2: [...] }
   A line may be a trench: { kind: "trench", side: "me" | "foe", tier: "front" | "support" | "back" } (no zone). Troops arriving go to their side's
   backline trench, and a unit standing in its own side's trench takes less damage (the rules' trenchCut / trenchKm).
   GET also returns citySides: { t1: { cityName: side }, t2: {...} } */
const TOPIC = ["t1", "t2"], MAX_LINES = 40, MAX_PTS = 120, MAX_POINTS = 60;
const clean = (v) => {
  if (!Array.isArray(v) || v.length > MAX_LINES) return null;
  const seen = new Set(), out = [];
  for (const l of v) {
    const id = String((l && l.id) || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24), name = String((l && l.name) || "").trim().slice(0, 40);
    if (!id || seen.has(id) || !name || !Array.isArray(l.pts) || l.pts.length < 2 || l.pts.length > MAX_PTS) return null;
    const pts = l.pts.map((p) => (Array.isArray(p) && p[0] != null && p[1] != null && p[0] !== "" && p[1] !== "" ? [Number(p[0]), Number(p[1])] : [NaN, NaN]));   /* Number(null) is 0: a missing coordinate must not become 0,0 */
    if (pts.some((p) => !(Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180))) return null;
    seen.add(id);
    const tr = l.kind === "trench" ? { kind: "trench", side: l.side === "foe" ? "foe" : "me", tier: ["front", "support", "back"].includes(l.tier) ? l.tier : "back" } : {};
    out.push({ id, name, zone: !tr.kind && (l.zone === "w" || l.zone === "e") ? l.zone : "", ...tr, pts: pts.map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]) });
  }
  return out;
};
const cleanPoints = (v) => {
  if (!Array.isArray(v) || v.length > MAX_POINTS) return null;
  const seen = new Set(), out = [];
  for (const q of v) {
    const id = String((q && q.id) || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24), lat = Number(q && q.lat), lon = Number(q && q.lon), r = Number(q && q.r);
    if (!id || seen.has(id) || (q.kind !== "weak" && q.kind !== "fort") || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180) || !(r >= 1 && r <= 1000)) return null;
    seen.add(id); out.push({ id, kind: q.kind, lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000, r: Math.round(r), name: String((q && q.name) || "").trim().slice(0, 40) });
  }
  return out;
};
module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me) return L.send(res, 401, { error: "auth" });
  const canEdit = me.role === "admin" || me.role === "chair";
  if (req.method === "GET") {
    const out = { canEdit };
    out.citySides = {}; out.points = {};
    for (const t of TOPIC) { out.points[t] = (await L.db.getKv("points:" + t)) || []; out[t] = (await L.db.getKv("lines:" + t)) || DEFAULTS[t].map((l) => ({ id: l.id, name: l.name, pts: l.pts })); out.citySides[t] = (await L.db.getKv("citysides:" + t)) || {}; }
    return L.send(res, 200, out);
  }
  if (!canEdit) return L.send(res, 403, { error: "forbidden" });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  if (req.method !== "POST") return L.send(res, 405, { error: "method" });
  const b = await L.readJson(req), t = String(b.topic || "");
  if (!TOPIC.includes(t)) return L.send(res, 400, { error: "topic" });
  if (b.citySide) {
    const nm = String(b.citySide.name || "").trim().slice(0, 40), sd = String(b.citySide.side || "");
    if (!nm || !["me", "foe", "n", "default"].includes(sd)) return L.send(res, 400, { error: "city" });
    await L.updateKv("citysides:" + t, (cur) => {   /* atomic: two chairs giving different cities to a side at once both land */
      const m = cur || {};
      if (sd === "default") delete m[nm]; else if (!["__proto__", "constructor", "prototype"].includes(nm) && (Object.keys(m).length < 400 || Object.prototype.hasOwnProperty.call(m, nm))) m[nm] = sd;
      return m;
    });
    return L.send(res, 200, { ok: true });
  }
  if (b.points !== undefined) {
    const pts = cleanPoints(b.points); if (!pts) return L.send(res, 400, { error: "points" });
    await L.db.setKv("points:" + t, pts); return L.send(res, 200, { ok: true });
  }
  if (b.reset) { await L.db.setKv("lines:" + t, null); return L.send(res, 200, { ok: true }); }
  const lines = clean(b.lines);
  if (!lines) return L.send(res, 400, { error: "lines" });
  await L.db.setKv("lines:" + t, lines);
  L.send(res, 200, { ok: true });
});
