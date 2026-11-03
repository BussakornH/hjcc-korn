"use strict";
/* Three-way merge of the troop list, used when the server says a chair's save is stale (api/troops.js answers 409).
     base   the list as this device last got it from the server
     mine   this device's list now, with the chair's edits in it
     theirs the list the server holds now (a delegate's HP change, another chair's edit, ...)
   Rules, troop by troop and field by field:
   - a field the chair changed keeps the chair's value; a field the chair did not touch takes the server's value (so a delegate's HP change survives)
   - a troop the chair deleted stays deleted; a troop the chair added is kept
   - a troop someone else added is kept; a troop someone else deleted is dropped
   Plain script (no imports) so the browser loads it as is and the tests can require() it. */
function mpMergeTroops(base, mine, theirs) {
  const index = (a) => { const m = new Map(); (a || []).forEach((x) => m.set(x.id, x)); return m; };
  const B = index(base), M = index(mine), T = index(theirs), out = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  T.forEach((t, id) => {
    const m = M.get(id), b = B.get(id);
    if (!m) { if (!b) out.push(t); return; }   /* the chair deleted it (it was in base), or someone else added it */
    if (!b) { out.push(m); return; }           /* both sides added the same id: the chair's */
    const r = Object.assign({}, t);
    Object.keys(m).forEach((k) => { if (!same(m[k], b[k])) r[k] = m[k]; });
    if (r.hp !== t.hp) r.lost = m.lost;        /* "lost" follows hp, so they must come from the same side */
    out.push(r);
  });
  M.forEach((m, id) => { if (!T.has(id) && !B.has(id)) out.push(m); });   /* added by the chair, not on the server yet */
  return out;
}
if (typeof module !== "undefined" && module.exports) module.exports = mpMergeTroops;
