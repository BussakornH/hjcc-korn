"use strict";
const L = require("./_lib");
const DEFAULTS = require("./_lines");

/* Battle lines, one list per topic, shared by every screen. Until a chair changes a topic it shows the defaults.
   GET                              -> { canEdit, t1: [{ id, name, pts }], t2: [...] }   (any signed-in role; pts are [lat, lon])
   POST { topic, lines }            -> replace the topic's lines (add, remove and reshape in one go)   (admin, chair)
   POST { topic, reset: true }      -> go back to the default lines                                    (admin, chair)
   POST { topic, citySide: { name, side } } -> give a city to a side: "me" | "foe" | "n", or "default" to clear   (admin, chair)
   GET also returns citySides: { t1: { cityName: side }, t2: {...} } */
const TOPIC = ["t1", "t2"], MAX_LINES = 12, MAX_PTS = 120;
const clean = (v) => {
  if (!Array.isArray(v) || v.length > MAX_LINES) return null;
  const seen = new Set(), out = [];
  for (const l of v) {
    const id = String((l && l.id) || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24), name = String((l && l.name) || "").trim().slice(0, 40);
    if (!id || seen.has(id) || !name || !Array.isArray(l.pts) || l.pts.length < 2 || l.pts.length > MAX_PTS) return null;
    const pts = l.pts.map((p) => [Number(p && p[0]), Number(p && p[1])]);
    if (pts.some((p) => !(Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180))) return null;
    seen.add(id); out.push({ id, name, zone: l.zone === "w" || l.zone === "e" ? l.zone : "", pts: pts.map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]) });
  }
  return out;
};
module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me) return L.send(res, 401, { error: "auth" });
  const canEdit = me.role === "admin" || me.role === "chair";
  if (req.method === "GET") {
    const out = { canEdit };
    out.citySides = {};
    for (const t of TOPIC) { out[t] = (await L.db.getKv("lines:" + t)) || DEFAULTS[t].map((l) => ({ id: l.id, name: l.name, pts: l.pts })); out.citySides[t] = (await L.db.getKv("citysides:" + t)) || {}; }
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
      if (sd === "default") delete m[nm]; else if (nm !== "__proto__" && (Object.keys(m).length < 400 || Object.prototype.hasOwnProperty.call(m, nm))) m[nm] = sd;
      return m;
    });
    return L.send(res, 200, { ok: true });
  }
  if (b.reset) { await L.db.setKv("lines:" + t, null); return L.send(res, 200, { ok: true }); }
  const lines = clean(b.lines);
  if (!lines) return L.send(res, 400, { error: "lines" });
  await L.db.setKv("lines:" + t, lines);
  L.send(res, 200, { ok: true });
});
