"use strict";
const L = require("./_lib");
const CHARS = require("./_chars");
const NAMES = CHARS.SIDE_NAMES, TOPIC = ["t1", "t2"], SIDES = ["me", "foe", "ne"];

/* Which side each character is on, day by day. Day 1 starts from the allocation sheet; a new day copies the day before.
   GET                                  -> admin / chair: { t1: { days: [{ n, sides: { charId: "me"|"foe"|"ne" } }] }, t2: {...}, names }
                                           delegate:      { mine: { t1?: {char, topic, day, side, label}, t2?: {...} } }
   POST { topic, day, id, side }        -> move one character                (admin, chair)
   POST { topic, addDay: true }         -> start the next day                (admin, chair)
   POST { topic, dropDay: true }        -> remove the last day               (admin, chair) */
const fresh = (t) => { const o = {}; CHARS.filter((c) => c.topic === t).forEach((c) => (o[c.id] = c.side || "ne")); return { days: [{ n: 1, sides: o }] }; };
const load = async (t) => (await L.db.getKv("days:" + t)) || fresh(t);

module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me) return L.send(res, 401, { error: "auth" });
  const staff = me.role === "admin" || me.role === "chair";
  if (req.method === "GET") {
    if (staff) { const out = { names: NAMES }; for (const t of TOPIC) out[t] = await load(t); return L.send(res, 200, out); }
    const mine = {}, own = (await L.db.allocs())[me.u] || {};
    for (const t of TOPIC) {
      const ch = CHARS.find((c) => c.id === own[t]); if (!ch) continue;
      const d = (await load(t)).days, last = d[d.length - 1], side = last.sides[ch.id] || "ne";
      mine[t] = { char: ch.name, topic: t, day: last.n, side, label: NAMES[t][side] };
    }
    return L.send(res, 200, { mine });
  }
  if (!staff) return L.send(res, 403, { error: "forbidden" });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  if (req.method !== "POST") return L.send(res, 405, { error: "method" });
  const b = await L.readJson(req), t = String(b.topic || "");
  if (!TOPIC.includes(t)) return L.send(res, 400, { error: "topic" });
  const st = await load(t);
  if (b.addDay) { const last = st.days[st.days.length - 1]; if (st.days.length >= 30) return L.send(res, 400, { error: "days" }); st.days.push({ n: last.n + 1, sides: Object.assign({}, last.sides) }); }
  else if (b.dropDay) { if (st.days.length < 2) return L.send(res, 400, { error: "last-day" }); st.days.pop(); }
  else {
    const day = st.days.find((x) => x.n === Number(b.day)), id = String(b.id || "");
    if (!day || !CHARS.some((c) => c.id === id && c.topic === t) || !SIDES.includes(b.side)) return L.send(res, 400, { error: "move" });
    day.sides[id] = b.side;
  }
  await L.db.setKv("days:" + t, st);
  L.send(res, 200, st);
});
