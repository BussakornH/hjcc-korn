"use strict";
const L = require("./_lib");
const CHARS = require("./_chars");

/* Troops placed on the battle map, one list per topic, shared by every screen. Each is a marker: where it stands, its symbol, and a copy of the unit's stats
   (the chairs' own forces stay in their browser; the copy is what everyone else sees, and the chair's page keeps it up to date).
   GET                       -> { canEdit, t1: [troop], t2: [troop], ver: { t1, t2 }, mine?: { t1, t2 } }   (any signed-in role; a delegate also gets the side they are on today)
   POST { topic, troops, base } -> replace the topic's troops              (admin, chair)
        base is the ver the caller last saw. If the list has changed since (a delegate's HP change, another chair's edit) nothing is written and the
        answer is 409 { error: "stale", ver, troops: <the current list> }, so the caller can merge its own edits onto it and send again.
        200 { ok, ver, troops } carries the new ver and the list as stored.
   POST { topic, hp: [{ id, hp }] } -> change the HP of troops on your own side   (a delegate, or staff). Applied on top of whatever is stored, never lost to a concurrent save.
   troop: { id, uid, name, code, aff, side, lat, lon, hp, maxhp, atk, mov, rng, lost }
   uid is the chair's unit id, "r:<username>:<unit id>" for a delegate's unit. Usernames may contain dots, so dots are kept. */
const TOPIC = ["t1", "t2"], MAX = 200;
const CODES = ["INF", "L-INF", "H-INF", "M-INF", "SF", "XBW", "HOB", "CAV", "ARC", "SIE", "GAL", "COG", "MAR", "ART", "ENG", "DES", "CRU", "DRD", "SUB", "FTR", "REC", "BMB", "NLF"];
const AFF = ["blue", "red", "neutral-green", "neutral-violet", "neutral-slate"];
const n = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : null; };
const clean = (v) => {
  if (!Array.isArray(v) || v.length > MAX) return null;
  const seen = new Set(), out = [];
  for (const x of v) {
    const id = String((x && x.id) || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24), name = String((x && x.name) || "").trim().slice(0, 40);
    const lat = n(x && x.lat, -90, 90), lon = n(x && x.lon, -180, 180), hp = n(x && x.hp, 0, 100000), maxhp = n(x && x.maxhp, 0, 100000);
    if (!id || seen.has(id) || !name || lat === null || lon === null || hp === null || maxhp === null || !CODES.includes(x.code) || !AFF.includes(x.aff)) return null;
    seen.add(id);
    out.push({ id, uid: String(x.uid || "").replace(/[^A-Za-z0-9_:.-]/g, "").slice(0, 64), name, code: x.code, aff: x.aff, side: x.side === "foe" || x.side === "ne" ? x.side : "me",
      lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000, hp: Math.min(hp, maxhp), maxhp, atk: n(x.atk, 0, 1000) || 0, mov: n(x.mov, 0, 1000) || 0, rng: n(x.rng, 0, 1000) || 0, lost: !!x.lost });
  }
  return out;
};
/* the side a delegate's character is on today: "me", "foe" or "ne" (the same days the Sides page keeps) */
async function sideOf(user, t) {
  const own = (await L.db.allocs())[user] || {}, ch = CHARS.find((c) => c.id === own[t]); if (!ch) return "ne";
  const days = (await L.db.getKv("days:" + t)) || { days: [{ n: 1, sides: Object.fromEntries(CHARS.filter((c) => c.topic === t).map((c) => [c.id, c.side || "ne"])) }] };
  return days.days[days.days.length - 1].sides[ch.id] || "ne";
}
module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me) return L.send(res, 401, { error: "auth" });
  const canEdit = me.role === "admin" || me.role === "chair";
  if (req.method === "GET") {
    const out = { canEdit, epoch: {}, ver: {} };
    for (const t of TOPIC) { const raw = await L.db.getKvRaw("troops:" + t); out[t] = (raw && JSON.parse(raw)) || []; out.ver[t] = L.verOf(raw); }
    for (const t of TOPIC) out.epoch[t] = (await L.db.getKv("epoch:" + t)) || 0;
    if (me.role === "delegate") { out.mine = {}; for (const t of TOPIC) out.mine[t] = await sideOf(me.u, t); }
    return L.send(res, 200, out);
  }
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  if (req.method !== "POST") return L.send(res, 405, { error: "method" });
  const b = await L.readJson(req), t = String(b.topic || "");
  if (!TOPIC.includes(t)) return L.send(res, 400, { error: "topic" });
  if (Array.isArray(b.hp)) {   /* HP only: a delegate may change troops on their own side, nothing else */
    const side = me.role === "delegate" ? await sideOf(me.u, t) : null; if (me.role === "delegate" && side === "ne") return L.send(res, 403, { error: "neutral" });
    const want = b.hp.slice(0, 200).filter((q) => q && q.hp != null && String(q.hp).trim() !== "" && typeof q.hp !== "boolean").map((q) => ({ id: String(q.id), v: Number(q.hp) })).filter((q) => Number.isFinite(q.v));   /* Number(null) and Number("") are 0: an entry without a number must not destroy the troop */
    await L.updateKv("troops:" + t, (cur) => {   /* runs again on the fresh list if someone else saved in the meantime */
      const list = cur || []; let changed = false;
      for (const q of want) {
        const x = list.find((y) => y.id === q.id);
        if (!x || (side && x.side !== side)) continue;
        const hp = Math.min(x.maxhp, Math.max(0, Math.round(q.v * 100) / 100)); if (hp !== x.hp) { x.hp = hp; x.lost = !(hp > 0); changed = true; }
      }
      return changed ? list : undefined;
    });
    return L.send(res, 200, { ok: true });
  }
  if (!canEdit) return L.send(res, 403, { error: "forbidden" });
  const troops = clean(b.troops);
  if (!troops) return L.send(res, 400, { error: "troops" });
  const key = "troops:" + t, stale = (raw) => L.send(res, 409, { error: "stale", ver: L.verOf(raw), troops: (raw && JSON.parse(raw)) || [] });
  const raw = await L.db.getKvRaw(key);
  if (String(b.base == null ? "" : b.base) !== L.verOf(raw)) return stale(raw);
  if (!(await L.db.casKv(key, raw, troops))) return stale(await L.db.getKvRaw(key));   /* someone saved between our read and our write */
  L.send(res, 200, { ok: true, ver: L.verOf(JSON.stringify(troops)), troops });
});
