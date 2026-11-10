"use strict";
/* SENTINEL troops on the battle map: the chairs place a unit from their forces anywhere on the map, drag it, and everyone sees it with its symbol and its HP.
   Click a troop and a reach line shows how far it can move this turn, shortened by mountains, forest, marsh, rivers and the sea.
   Loaded after map.js (it adds to MAPA) and before app.js. Stored on the server by api/troops.js. */
let TR = { t1: [], t2: [] }, mpTPend = 0, mpTGen = 0, mpTS = null, mpPlace = null, mpTDrag = null, mpRG = null, mpTSaveT = 0, mpPing = null, mpPingT = 0;
const MPAFF = [["blue", "Blue"], ["red", "Red"], ["neutral-green", "Green"], ["neutral-violet", "Violet"], ["neutral-slate", "Slate"]];
const MPAFFC = { blue: "#0a7cff", red: "#ff453a", "neutral-green": "#2fb85a", "neutral-violet": "#a259f0", "neutral-slate": "#8a91a0" };
const MPSEA = ["GAL", "COG", "DES", "CRU", "DRD", "SUB"], MPAIR = ["FTR", "REC", "BMB"];
const mpDomain = c => MPAIR.includes(c) ? "air" : MPSEA.includes(c) ? "sea" : "land";
const mpHpCol = p => p > 66 ? "#34c759" : p > 33 ? "#ff7a45" : "#ff453a";
const mpTroops = () => TR[S.topic] || [];
const mpTrFind = id => mpTroops().find(x => x.id === id);

/* A troop and the chair's unit of the same id are one thing: HP and stats move both ways.
   The server copy is what everyone else sees; each chair device keeps a mirror unit so the combat calculator can fight it.
   mpAg holds what the two last agreed on, so a change on either side is told apart from an old value. */
const mpFlat = s => String(s).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);   /* what an older server kept of an id with colons in it */
const mpNoDot = s => String(s).replace(/[^A-Za-z0-9_:-]/g, "").slice(0, 64);   /* what the server kept of a uid before it allowed dots (a username can have them) */
const mpAg = {}, MPF = ["name", "hp", "maxhp", "atk", "mov", "rng"];
let mpTLoaded = false, TRMINE = {};
/* What the server's list for each topic looked like when this device last loaded or saved it (TRB) and its version tag (TRVER).
   A save sends the tag; if the list has changed since (a delegate's HP change, another chair), the server refuses with 409 and
   the chair's edits are merged onto the new list (troops-merge.js) instead of overwriting it. */
const TRVER = { t1: "0", t2: "0" }, TRB = { t1: [], t2: [] }, mpClone = v => JSON.parse(JSON.stringify(v));
/* mpTGen counts local troop changes (a save queued, a save finished, an HP patch sent). A reload remembers the count when it is sent and is
   thrown away if the count has moved by the time the answer arrives: the answer was read before our change reached the server, and applying it
   would put the old HP back on screen (and, if the chair then moved a unit, back on the server). The next reload picks the list up instead. */
function mpTrAdopt(j) {
  ["t1", "t2"].forEach(t => { TR[t] = j[t] || []; TRVER[t] = (j.ver && j.ver[t]) || "0"; TRB[t] = mpClone(TR[t]); });
}
/* ---------- every side's forces, for the chairs ----------
   A delegate's own units are copied to the server whenever they change; a chair's copy of them is rebuilt from there (read only, marked "remote"). */
let mpFSent = {}, mpFT = 0;
function mpForcesPush() {
  if (typeof ROLE === "undefined" || ROLE !== "delegate") return; clearTimeout(mpFT);
  mpFT = setTimeout(() => ["t1", "t2"].forEach(t => {
    const d = S.topics[t]; if (!d) return;
    const units = d.units.filter(u => u.side === "me" && !u.mirror && !u.remote).slice(0, 300).map(u => ({ id: u.id, name: u.name, code: u.tcode || "", cls: u.tname || "", branch: u.branch || "", hp: num(u.hp), maxhp: num(u.maxhp), atk: num(u.atk), mov: num(u.mov), rng: num(u.rng), fr: u.front === "reserve" ? "reserve" : (u.front === "lost" || lost(u)) ? "lost" : "front" })), j = JSON.stringify(units);
    if (mpFSent[t] === j) return;
    /* A brand-new device (new browser, private window, cleared site data) starts with no units. Pushing that empty list would wipe the copy
       the chairs see. Only send an empty list from a device that has itself sent units for this topic before. */
    const fk = "hjcc-fpush:" + KEY + ":" + t; let owns = false; try { owns = localStorage.getItem(fk) === "1"; } catch (e) {}
    if (!units.length && !owns) return;
    SentinelAuth.api("POST", "/api/forces", { topic: t, units }).then(r => { if (r.ok) { mpFSent[t] = j; if (units.length) { try { localStorage.setItem(fk, "1"); } catch (e) {} } } }).catch(() => {});
  }), 1200);
}
let mpFOk = false;
function mpForcesLoad() {
  if (ROLE !== "chair") return Promise.resolve();
  return SentinelAuth.api("GET", "/api/forces").then(r => r.ok ? r.json() : null).then(j => {
    if (!j) return; mpFOk = true; let changed = false;
    ["t1", "t2"].forEach(t => {
      const d = S.topics[t]; if (!d) return; const want = new Map(), fr = (d.fronts.find(f => !f.fixed) || d.fronts[0]).id;
      (j[t] || []).forEach(g => g.units.forEach(x => want.set("r:" + g.user + ":" + x.id, { g, x })));
      d.units = d.units.filter(u => { if (u.remote && !want.has(u.id)) { changed = true; return false; } return true; });
      want.forEach(({ g, x }, id) => {
        const ty = d.types.find(y => y.code === x.code), front = x.fr === "reserve" ? "reserve" : x.fr === "lost" ? "lost" : fr;
        let u = d.units.find(y => y.id === id);
        const nu = { side: g.side, name: x.name, hp: x.hp, maxhp: x.maxhp, atk: x.atk, mov: x.mov, rng: x.rng, front, remote: g.user };
        if (!u) { u = mkUnit(d, { side: g.side, t: ty, name: x.name, front, hp: x.hp, maxhp: x.maxhp, atk: x.atk, mov: x.mov, rng: x.rng }); u.id = id; u.remote = g.user; u.fsv = { hp: x.hp, fr: x.fr }; d.units.push(u); changed = true; return; }
        /* HP and front: the chair may override them (a battle applied, an HP edit), so the delegate's copy only wins when the delegate changed it since this device last looked
           (u.fsv is what it said then). Copying it back unconditionally put the old HP on the unit after every battle, and for a unit on the map mpTroopSync then sent that
           old HP to the server as if the chair had set it. A unit with a marker takes HP from the marker instead (mpTroopSync), never from here. */
        const placed = (TR[t] || []).some(m => m.uid === id), moved = !u.fsv || u.fsv.hp !== x.hp || u.fsv.fr !== x.fr;
        Object.keys(nu).forEach(k => { if ((k === "hp" || k === "front") && (placed || !moved)) return; if (u[k] !== nu[k]) { u[k] = nu[k]; changed = true; } });
        if (moved) { u.fsv = { hp: x.hp, fr: x.fr }; changed = true; }
      });
    });
    if (changed) { save(); if (!mpTDrag && !(typeof dragging === "function" && dragging())) render(); }
  }, () => {});
}
/* A chair's own copy holds only the delegates' units (marked remote) and any unit a marker on the map points to. Anything else is old data from before forces were kept per sign-in: it goes.
   Runs once both the delegates' forces and the troops have come back, so a unit a marker needs is never taken for junk. */
function mpChairRepair() {
  if (ROLE !== "chair" || !mpFOk) return; let ch = false, mk = false;
  ["t1", "t2"].forEach(t => {
    const d = S.topics[t]; if (!d) return; if (d.alloc.delegation || d.alloc.portfolio) { d.alloc.delegation = ""; d.alloc.portfolio = ""; ch = true; }
    const remote = d.units.filter(u => u.remote), mks = TR[t] || [];
    d.units = d.units.filter(u => {
      if (u.remote) return true;
      const twin = remote.find(r => r.id.endsWith(":" + u.id));
      if (twin) { mks.forEach(x => { if (x.uid === u.id) { x.uid = twin.id; mk = true; } }); ch = true; return false; }
      if (mks.some(x => x.uid === u.id)) return true;
      ch = true; return false;
    });
  });
  ["t1", "t2"].forEach(t => { const d = S.topics[t]; if (!d) return; (TR[t] || []).forEach(x => { const u = d.units.find(y => y.id === x.uid && y.remote); if (u && u.side !== x.side) { x.side = u.side; x.aff = mpAffOf(u.side); mk = true; ch = true; } }); });   /* a neutral who joins a side takes that side's colour */
  if (ch) { save(); if (mk) mpTroopSave(); render(); }
}
/* the admin's "reset everything" stamps a new epoch: a browser that has not seen it clears its own forces for that topic */
function mpEpoch(ep) {
  if (!ep || ROLE === "admin") return; let ch = false;
  ["t1", "t2"].forEach(t => {
    const k = "hjcc-epoch:" + KEY + ":" + t; let seen = null; try { seen = localStorage.getItem(k); } catch (e) {}
    if (!ep[t] || seen === String(ep[t])) return;
    try { localStorage.setItem(k, String(ep[t])); } catch (e) {}
    if (S.topics[t]) { const old = S.topics[t]; S.topics[t] = newTopic(t); S.topics[t].sides = old.sides; S.topics[t].alloc = old.alloc; S.topics[t].rules = old.rules; delete mpFSent[t]; ch = true; }
  });
  if (ch) { UNDO.length = 0; save(); render(); }
  return ch;
}
function mpTroopsLoad() {
  mpTLoaded = true; const fp0 = mpForcesLoad(), gen = mpTGen;
  return SentinelAuth.api("GET", "/api/troops").then(r => r.ok ? r.json() : null).then(j => {
    if (!j) return;
    /* A new epoch clears this device's forces. The delegates' forces were asked for at the same moment and may already be in: without asking again
       a chair's first page after a reset showed no forces at all until the next reload, ten seconds later. */
    const fp = mpEpoch(j.epoch) ? fp0.then(mpForcesLoad) : fp0;
    if (mpTPend || mpTDrag || gen !== mpTGen) return; mpTrAdopt(j); TRMINE = j.mine || {};
    if (mpTroopSync() && typeof UI !== "undefined" && UI.page !== "map") render();   /* the forces list changed under you */
    fp.then(mpChairRepair);
  }, () => {});
}
/* returns true when this device's own units were changed to match the server */
function mpTroopSync() {
  if (typeof ROLE === "undefined" || ROLE === "admin") return false;
  const del = ROLE === "delegate"; let push = false, local = false; const patch = {};
  ["t1", "t2"].forEach(t => {
    const d = S.topics[t], mine = del ? TRMINE[t] : null; if (!d) return;
    { const ids = new Set(), n = d.units.length; d.units = d.units.filter(y => { if (y.mirror && ids.has(y.id)) return false; ids.add(y.id); return true; }); if (d.units.length !== n) { save(); local = true; } }   /* copies an older version made of one mirror (see below) */
    if (del && (!mine || mine === "ne")) return;
    (TR[t] || []).forEach(x => {
      const own = !del || x.side === mine, ls = del ? (own ? "me" : "foe") : x.side;   /* a delegate sees their own side's troops as "my forces", the other side's as the enemy */
      const mu = String(SentinelAuth.user() || "").toLowerCase(), pre = "r:" + mu + ":", xid = del && x.uid.toLowerCase().startsWith(pre) ? x.uid.slice(pre.length) : x.uid;   /* a chair put one of your own units on the map */
      /* On a device that does not hold the unit itself (a second device, a private window, or the unit was removed from the roster) your own unit on the map
         is kept as a mirror under the marker's full uid. Looking only for the short id never found that mirror again, so every sync added one more copy. */
      let u = d.units.find(y => y.id === xid) || (xid !== x.uid ? d.units.find(y => y.id === x.uid) : null);
      if (!u && del) { u = d.units.find(y => !y.mirror && (mpFlat("r:" + mu + ":" + y.id) === x.uid || mpNoDot("r:" + mu + ":" + y.id) === x.uid)); if (u) { d.units = d.units.filter(y => !(y.mirror && y.id === x.uid)); save(); local = true; } }   /* the same unit, under an id the server cut short */
      if (!u && !del) { const o = x.uid; u = d.units.find(y => y.remote && (mpFlat(y.id) === o || mpNoDot(y.id) === o)); if (u) { x.uid = u.id; d.units = d.units.filter(y => y.remote || y.id !== o); push = true; save(); local = true; } }
      if (!u) {
        const ty = d.types.find(y => y.code === x.code), fr = d.fronts.find(f => !f.fixed) || d.fronts[0];
        u = mkUnit(d, { side: ls, t: ty, name: x.name, front: x.lost ? "lost" : fr.id, hp: x.hp, maxhp: x.maxhp, atk: x.atk, mov: x.mov, rng: x.rng }); u.id = x.uid; u.mirror = true; d.units.push(u); save(); local = true;
      }
      if (u.side !== ls) {
        /* A delegate's unit takes its side from the Sides page (it arrives with the delegates' forces). When the character changes side the marker follows the unit;
           copying the marker's old side back onto the unit kept the troop in its old colour for good, and its own delegate then saw it as an enemy. */
        if (!del && u.remote && mpFOk) { x.side = u.side; x.aff = mpAffOf(u.side); push = true; }
        else { u.side = ls; save(); local = true; }
      }
      const ag = mpAg[x.id], now = {}; MPF.forEach(k => { now[k] = k === "name" ? u.name : num(u[k]); });
      MPF.forEach(k => {
        const two = !del || (own && k === "hp"), take = () => { if (k === "name") u.name = x.name; else if (k === "hp") setHp(d, u, x.hp); else u[k] = x[k]; local = true; save(); };
        if (!ag || !two) { if (now[k] !== x[k]) take(); return; }
        if (now[k] !== ag[k]) { x[k] = now[k]; if (del) (patch[t] = patch[t] || {})[x.id] = now[k]; else push = true; }   /* changed here (a battle, an edit): tell the server */
        else if (x[k] !== ag[k]) take();                                                                                   /* changed elsewhere: take it */
      });
      const lz = !!lost(u); if (!del && x.lost !== lz) { x.lost = lz; push = true; }
      mpAg[x.id] = {}; MPF.forEach(k => { mpAg[x.id][k] = k === "name" ? u.name : num(u[k]); });
    });
  });
  if (push) mpTroopSave();
  Object.keys(patch).forEach(t => { mpTGen++; SentinelAuth.api("POST", "/api/troops", { topic: t, hp: Object.keys(patch[t]).map(id => ({ id, hp: patch[t][id] })) }).catch(() => {}).then(() => { mpTGen++; }); });
  return local;
}
/* Saves are batched for a quarter second. Each one carries the version tag it is based on; on 409 ("stale") the chair's edits are merged
   onto the list the server sent back and the save is tried again, a few times at most. */
const mpTDirty = new Set(); let mpTBusy = false;
function mpTroopSave() { mpTGen++; mpTDirty.add(S.topic); mpTPend = 1; clearTimeout(mpTSaveT); mpTSaveT = setTimeout(mpTroopFlush, 250); }
async function mpTroopFlush() {
  mpTSaveT = 0;
  if (mpTBusy) { mpTSaveT = setTimeout(mpTroopFlush, 250); return; }
  mpTBusy = true; let merged = false;
  try {
    for (const t of Array.from(mpTDirty)) {
      mpTDirty.delete(t);
      for (let n = 0; ; n++) {
        const r = await SentinelAuth.api("POST", "/api/troops", { topic: t, troops: TR[t] || [], base: TRVER[t] || "0" }), j = await r.json().catch(() => null);
        if (r.ok && j && j.ver) { TRVER[t] = j.ver; TRB[t] = mpClone(j.troops || []); break; }
        if (r.status === 409 && j && j.error === "stale" && Array.isArray(j.troops) && n < 4) {
          TR[t] = mpMergeTroops(TRB[t], TR[t] || [], j.troops); TRVER[t] = j.ver; TRB[t] = mpClone(j.troops); merged = true; continue;
        }
        throw new Error("troops");
      }
    }
  } catch (e) { mpTGen++; mpTDirty.clear(); mpTBusy = false; mpTPend = 0; toast("Could not save the troops, try again"); mpTroopsLoad(); return; }
  mpTGen++; mpTBusy = false; mpTPend = mpTDirty.size || mpTSaveT ? 1 : 0;
  if (merged) { mpTroopSync(); mpRG = null; if (!mpTDrag) render(); }   /* someone else's change came in: show it and carry it into this chair's own units */
}

/* ---------- the markers ---------- */
function mpTroopsSvg(t) {
  const g = mpGeo(t);
  return (TR[t] || []).map(x => {
    const p = mpXY(g, x.lat, x.lon); if (p[0] < -20 || p[0] > g.W + 20 || p[1] < -20 || p[1] > g.H + 20) return "";
    const pc = x.maxhp > 0 ? Math.max(0, Math.min(1, x.hp / x.maxhp)) : 0, on = x.id === mpTS;
    return `<g class="trp${on ? " on" : ""}${x.lost ? " dead" : ""}" data-a="mapTroop" data-id="${esc(x.id)}" transform="translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})"><g class="trp-i">${on ? '<circle class="trp-r" r="34"/>' : ""}${x.id === mpPing ? '<circle class="trp-ping" r="34"/><circle class="trp-ping b" r="34"/>' : ""}<circle class="trp-hit" r="30"/><image href="symbols/${x.aff}/${x.code}.png" x="-30" y="-30" width="60" height="60"/><rect class="trp-hb" x="-19" y="20" width="38" height="4.5" rx="2.2"/><rect x="-19" y="20" width="${(38 * pc).toFixed(1)}" height="4.5" rx="2.2" style="fill:${mpHpCol(pc * 100)}"/><text class="trp-n" y="38">${esc(x.name)}</text></g></g>`;
  }).join("");
}
const mpTroopsRedraw = () => { const e = document.getElementById("mp-troops"); if (e) e.innerHTML = mpTroopsSvg(S.topic); };

/* ---------- the reach line ----------
   Cost of crossing ground, per km of walking: open ground 1, hills and mountains up to 5, forest x1.7, marsh x2.5, a river crossing a flat 6 to 15 km; sea is shut to land
   troops and land is shut to ships. The cheapest way to every 10 km square is found (Dijkstra) and the 100% and 50% limits of the move are drawn from it. */
function mpHeap() {
  const a = [], up = i => { while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } };
  const dn = i => { for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } };
  return { n: () => a.length, push: v => { a.push(v); up(a.length - 1); }, pop: () => { const t = a[0], e = a.pop(); if (a.length) { a[0] = e; dn(0); } return t; } };
}
function mpIso(v, N, T, pos) {
  const pts = new Map(), adj = new Map();
  const val = (i, j) => v[j * N + i];
  const edge = (i, j, e) => {   /* crossing point on the edge e of the square at (i, j): 0 top, 1 right, 2 bottom, 3 left */
    const a = e === 0 ? [i, j, i + 1, j] : e === 1 ? [i + 1, j, i + 1, j + 1] : e === 2 ? [i, j + 1, i + 1, j + 1] : [i, j, i, j + 1], key = (a[1] === a[3] ? "h" : "v") + a[0] + "," + a[1];
    if (!pts.has(key)) { const va = val(a[0], a[1]), vb = val(a[2], a[3]), u = va === vb ? 0.5 : (T - va) / (vb - va), p0 = pos(a[0], a[1]), p1 = pos(a[2], a[3]); pts.set(key, [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u]); }
    return key;
  };
  const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
  const CASE = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[3, 1]], 13: [[0, 1]], 14: [[3, 0]] };
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const c = (val(i, j) <= T ? 1 : 0) | (val(i + 1, j) <= T ? 2 : 0) | (val(i + 1, j + 1) <= T ? 4 : 0) | (val(i, j + 1) <= T ? 8 : 0), s = CASE[c];
    if (s) s.forEach(q => link(edge(i, j, q[0]), edge(i, j, q[1])));
  }
  const seen = new Set(); let d = "";
  adj.forEach((_, k0) => {
    if (seen.has(k0)) return; let cur = k0, prev = null, part = "";
    for (let guard = 0; guard < 20000; guard++) {
      seen.add(cur); const p = pts.get(cur); part += (part ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1);
      const nx = (adj.get(cur) || []).find(k => k !== prev && !seen.has(k)); if (!nx) break; prev = cur; cur = nx;
    }
    d += part + "Z";
  });
  return d;
}
function mpRangeFor(t, x) {
  if (!x || !(x.mov > 0)) return null;
  const key = [t, x.id, x.lat, x.lon, x.mov, x.code, (mpDEM[t] || {}).w].join("|"); if (mpRG && mpRG.key === key) return mpRG;
  const g = mpGeo(t), T = window.SENTINEL_TERRAIN || {}, dom = mpDomain(x.code), kmU = 111.2 / g.sc, CELL = 10, cu = CELL / kmU, budget = x.mov * (T.kmPerMov || 30);
  const R = Math.ceil(budget / CELL) + 1, N = 2 * R + 1, c0 = mpXY(g, x.lat, x.lon), ox = c0[0] - R * cu, oy = c0[1] - R * cu, D = mpDEM[t];
  const pos = (i, j) => [ox + i * cu, oy + j * cu], cost = new Float32Array(N * N), pen = new Float32Array(N * N);
  const elev = (lat, lon) => { if (!D || !D.w) return 0; const gx = Math.floor((lon - D.lon0) / D.st), gy = Math.floor((D.lat1 - lat) / D.st); return gx < 0 || gy < 0 || gx >= D.w || gy >= D.h ? -1 : D.a[gy * D.w + gx]; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const p = pos(i, j), ll = mpLL(g, p[0], p[1]), e = dom === "air" ? 1 : elev(ll[0], ll[1]);
    cost[j * N + i] = dom === "air" ? 1 : dom === "land" ? (e < 0 ? Infinity : 1 + Math.max(0, e - 300) / 700) : (e < 0 ? 1 : Infinity);
  }
  if (dom === "land") {
    const toG = a => { const q = mpXY(g, a[0], a[1]); return [(q[0] - ox) / cu, (q[1] - oy) / cu]; };
    (T.forests || []).forEach(f => {
      const P = f.p.map(toG); let a = 1e9, b = -1e9, c = 1e9, d = -1e9; P.forEach(q => { a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); });
      if (b < 0 || a > N || d < 0 || c > N) return; const m = f.k === "marsh" ? 2.5 : 1.7;
      for (let j = Math.max(0, Math.floor(c)); j <= Math.min(N - 1, Math.ceil(d)); j++) for (let i = Math.max(0, Math.floor(a)); i <= Math.min(N - 1, Math.ceil(b)); i++) {
        let inside = false; for (let k = 0, l = P.length - 1; k < P.length; l = k++) if ((P[k][1] > j) !== (P[l][1] > j) && i < (P[l][0] - P[k][0]) * (j - P[k][1]) / (P[l][1] - P[k][1]) + P[k][0]) inside = !inside;
        if (inside) cost[j * N + i] *= m;
      }
    });
    const rivers = ((typeof mpTD !== "undefined" && mpTD && mpTD.rivers) || []).concat(T.rivers || []);
    rivers.forEach(r => {
      const w = r.w > 1 ? 15 : 6, P = r.p.map(toG); let a = 1e9, b = -1e9, c = 1e9, d = -1e9; P.forEach(q => { a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); });
      if (b < -1 || a > N + 1 || d < -1 || c > N + 1) return;
      for (let s = 0; s < P.length - 1; s++) { const dx = P[s + 1][0] - P[s][0], dy = P[s + 1][1] - P[s][1], n = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2)); for (let u = 0; u <= n; u++) { const i = Math.round(P[s][0] + dx * u / n), j = Math.round(P[s][1] + dy * u / n); if (i >= 0 && j >= 0 && i < N && j < N) pen[j * N + i] = Math.max(pen[j * N + i], w); } }
    });
  }
  const dist = new Float64Array(N * N).fill(Infinity), h = mpHeap(), start = R * N + R; dist[start] = 0; h.push([0, start]);
  while (h.n()) {
    const [d0, k] = h.pop(); if (d0 > dist[k]) continue; const ci = k % N, cj = (k - ci) / N;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue; const n = j * N + i, c = cost[n]; if (c === Infinity) continue;
      const nd = d0 + CELL * (di && dj ? 1.414 : 1) * (c + cost[k]) / 2 + pen[n]; if (nd < dist[n] && nd <= budget) { dist[n] = nd; h.push([nd, n]); }
    }
  }
  const v = new Float32Array(N * N); for (let n = 0; n < v.length; n++) v[n] = dist[n] === Infinity ? budget * 3 : dist[n];
  let far = 0; dist.forEach(q => { if (q !== Infinity && q > far) far = q; });
  return (mpRG = { key, dist, N, cost, pen, full: mpIso(v, N, budget, pos), half: mpIso(v, N, budget / 2, pos), budget, dom });
}
const mpRangeSvg = t => { const x = mpTrFind(mpTS); if (!x) return ""; const r = mpRangeFor(t, x); return r ? `<path class="rg-f" d="${r.full}" fill-rule="evenodd"/><path class="rg-h" d="${r.half}" fill-rule="evenodd"/>` : ""; };

/* ---------- the side panel ---------- */
const mpLatLon = x => Math.abs(x.lat).toFixed(2) + "°" + (x.lat < 0 ? "S" : "N") + " " + Math.abs(x.lon).toFixed(2) + "°" + (x.lon < 0 ? "W" : "E");
function mpTroopCard() {
  const x = mpTrFind(mpTS); if (!x) return ""; const chair = ROLE !== "delegate", pc = x.maxhp > 0 ? Math.round(x.hp / x.maxhp * 100) : 0, km = Math.round(x.mov * ((window.SENTINEL_TERRAIN || {}).kmPerMov || 30)), local = chair && x.uid && D().units.some(u => u.id === x.uid);
  const dom = mpDomain(x.code);
  return `<section class="panel mp-card"><div class="trc"><img src="symbols/${x.aff}/${x.code}.png" alt=""><div><b>${esc(x.name)}</b><span>${esc(x.code)}${x.lost ? " · destroyed" : ""}</span></div></div>
    <div class="trc-hp"><div class="trc-bar"><i style="width:${pc}%;background:${mpHpCol(pc)}"></i></div><span>HP <b>${fx(x.hp)}</b> / ${fx(x.maxhp)} · ${pc}%</span></div>
    <div class="trc-st"><span>ATK <b>${fx(x.atk)}</b></span><span>MOV <b>${fx(x.mov)}</b></span><span>RNG <b>${fx(x.rng)}</b></span><span class="trc-pos">AT <b>${mpLatLon(x)}</b></span></div>
    <div class="mp-act trc-go"><button class="btn sm" data-a="mapTrPin" title="Move the map to this unit and mark where it stands">${ico("pin")} Pinpoint location</button>${local && ROLE !== "admin" ? `<button class="btn sm primary" data-a="mapTrCalc" title="Put this unit into the combat calculator and open it">${ico("swords")} Open in calculator</button>` : ""}</div>
    <p class="muted" style="margin:8px 0 0">${x.mov > 0 ? `Reach this turn: up to ${km} km on open ground${dom === "air" ? "" : dom === "sea" ? ", on water only" : ". Mountains, forest, marsh and river crossings shorten it"}. The solid line is the full move, the dashed line half of it.` : "This unit does not move."}</p>
    ${chair ? `<div class="mp-act" style="flex-wrap:wrap;margin-top:12px">${local ? `<button class="btn sm" data-a="mapTrHp" data-d="-1">−1 HP</button><button class="btn sm" data-a="mapTrHp" data-d="1">+1 HP</button><button class="btn sm" data-a="mapTrTray" title="Keep it for the next engagement without leaving the map">${ico("plus")} Add to battle tray</button>` : ""}<button class="btn sm danger" data-a="mapTrDel">Take off the map</button></div>
${local ? "" : '<p class="muted" style="margin-top:8px">This troop is not in your forces on this device, so its HP cannot be changed here.</p>'}` : ""}</section>`;
}
let mpLDrag = null;
const mpAffOf = s => s === "me" ? "blue" : s === "foe" ? "red" : "neutral-slate";
/* the two troop columns beside the map: Allied on the left, Central Powers on the right. Each holds the units still to drag onto the map (chairs) and the troops of that side on it; the card of the chosen troop sits at the top of its side */
/* units are grouped by branch of service (Army, Navy, Airforce, Marine), each branch folds away over its units and remembers it was opened */
let mpGOpen = new Set();
function mpBranchOf(code, uid) {
  const d = D(), u = uid && d.units.find(y => y.id === uid), t = d.types.find(y => y.code === code);
  return (u && u.branch) || (t && t.branch) || (mpDomain(code) === "air" ? "air" : mpDomain(code) === "sea" ? "navy" : "army");
}
function mpGroups(side, kind, items, codeOf, row) {
  const d = D(), g = new Map(); items.forEach(x => { const k = mpBranchOf(codeOf(x), x.uid || x.id); if (!g.has(k)) g.set(k, []); g.get(k).push(x); });
  const order = id => { const i = d.branches.findIndex(b => b.id === id); return i < 0 ? 99 : i; };
  return [...g].sort((a, b) => order(a[0]) - order(b[0])).map(([k, xs]) => { const id = side + "|" + kind + "|" + k, open = mpGOpen.has(id), br = d.branches.find(b => b.id === k) || { name: "Other", color: "#6b7380" };
    return `<div class="mp-grp${open ? " open" : ""}"><button class="mp-gh" data-a="mapGrp" data-k="${esc(id)}" aria-expanded="${open}"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg><i class="mp-gdot" style="background:${esc(br.color)}"></i><b>${esc(br.name)}</b><small>${xs.length}</small></button><div class="mp-gb">${xs.map(row).join("")}</div></div>`; }).join("");
}
function mpTroopCol(t, col) {
  const chair = ROLE !== "delegate", d = D(), side = col === "L" ? "me" : "foe", aff = mpAffOf(side), ty = mpPlace && d.units.find(x => x.id === mpPlace), nm = sideLbl(side);
  const sel = mpTrFind(mpTS), card = sel && (col === "L") === (sel.side === "me") ? mpTroopCard() : "";
  const placed = new Set(mpTroops().map(x => x.uid)), free = d.units.filter(u => u.side === side && !lost(u) && !placed.has(u.id)), fn = id => id === "reserve" ? "Reserve" : ((d.fronts.find(f => f.id === id) || {}).name || "Front");
  const row = u => { const rs = u.front === "reserve"; return `<div class="trt${rs ? " res" : ""}${u.id === mpPlace ? " on" : ""}" role="button" tabindex="0" data-a="mapTrType" data-id="${esc(u.id)}" title="${rs ? "In reserve. " : ""}Drag onto the map, or click and then click the map"><img src="symbols/${aff}/${esc(MPCODES.includes(u.tcode) ? u.tcode : "INF")}.png" alt="" draggable="false"><span><b>${esc(u.name)}${rs ? '<em class="trt-tag">Reserve</em>' : ""}</b><i>${rs ? "" : esc(fn(u.front)) + " · "}ATK ${fx(u.atk)} · HP ${fx(u.hp)}/${fx(u.maxhp)} · MOV ${fx(u.mov)}</i></span></div>`; };
  const act = free.filter(u => u.front !== "reserve"), res = free.filter(u => u.front === "reserve");
  const sect = (cls, label, n, body) => `<div class="mp-ob ${cls}"><div class="mp-ob-h"><b>${label}</b><small>${n}</small></div>${body}</div>`;
  const kinds = chair ? `<section class="panel mp-card"><div class="panel-h" style="margin:0 0 8px"><div><h3>${esc(nm)}</h3><p>${ty && ty.side === side ? `Click the map to put down ${esc(ty.name)}. Esc to stop.` : "Order of battle: drag a unit onto the map"}</p></div></div><div class="trt-g">${free.length ? sect("act", "Active", act.length, act.length ? mpGroups(side, "ob", act, u => u.tcode, row) : '<p class="muted" style="margin:4px 0 8px">No active units off the map.</p>') + (res.length ? sect("res", "Reserve", res.length, mpGroups(side, "ob-res", res, u => u.tcode, row)) : "") : '<p class="muted" style="margin:8px 0 0">Every unit on this side is on the map. Add more on the Order of Battle page.</p>'}</div></section>` : "";
  const on = mpTroops().filter(x => x.side === side).sort((a, b) => a.name.localeCompare(b.name));
  const list = `<section class="panel mp-card"><div class="panel-h" style="margin:0 0 6px"><div><h3>${chair ? "On the map" : esc(nm)}</h3><p>${on.length ? plural(on.length, "troop") + (chair ? "" : " on the map") : "No troops placed yet"}</p></div></div>${mpGroups(side, "map", on, x => x.code, x => { const pc = x.maxhp > 0 ? Math.round(x.hp / x.maxhp * 100) : 0; return `<button class="trl-row${x.id === mpTS ? " on" : ""}${x.lost ? " dead" : ""}" data-a="mapTroop" data-id="${esc(x.id)}"><img src="symbols/${x.aff}/${esc(x.code)}.png" alt=""><span><b>${esc(x.name)}</b><em><i style="width:${pc}%;background:${mpHpCol(pc)}"></i></em></span><small>${fx(x.hp)}/${fx(x.maxhp)}</small></button>`; })}</section>`;
  return card + kinds + list;
}
const MPCODES = ["INF", "L-INF", "H-INF", "M-INF", "SF", "XBW", "HOB", "CAV", "ARC", "SIE", "GAL", "COG", "MAR", "ART", "ENG", "DES", "CRU", "DRD", "SUB", "FTR", "REC", "BMB", "NLF"];

Object.assign(MAPA, {
  mapTroop: el => { mpPlace = null;   /* a unit picked from the list for placing used to swallow every click on a marker; clicking a marker now just stops the placing */
    mpTS = el.dataset.id === mpTS ? null : el.dataset.id; mpRG = null;
    const x = mpTS && mpTrFind(mpTS);
    if (x && MPV && el.closest(".mp-tl")) { const p = mpXY(mpGeo(S.topic), x.lat, x.lon), m = 0; if (p[0] < MPV.x + m || p[0] > MPV.x + MPV.w - m || p[1] < MPV.y + m || p[1] > MPV.y + MPV.h - m) { MPV.x = p[0] - MPV.w / 2; MPV.y = p[1] - MPV.h / 2; mpClampView(); } }   /* a troop out of sight comes into view */
    render(); },
  mapGrp: el => { const k = el.dataset.k, g = el.closest(".mp-grp"), o = !mpGOpen.has(k); o ? mpGOpen.add(k) : mpGOpen.delete(k); if (g) g.classList.toggle("open", o); el.setAttribute("aria-expanded", o); },
  mapTrType: el => { mpPlace = mpPlace === el.dataset.id ? null : el.dataset.id; mpTS = null; render(); },
  mapTrDel: () => { const t = S.topic; TR[t] = mpTroops().filter(x => x.id !== mpTS); mpTS = null; render(); mpTroopSave(); },
  mapTrAff: el => { const x = mpTrFind(mpTS); if (!x) return; x.aff = el.dataset.f; render(); mpTroopSave(); },
  mapTrHp: el => {   /* the chairs' forces are view-only elsewhere, but the troops on their map are theirs to hurt or heal */
    const x = mpTrFind(mpTS), d = D(), u = x && d.units.find(y => y.id === x.uid); if (!u) return;
    if (u.remote) { toast("That unit belongs to " + u.remote + ": they change its HP"); return; }
    const old = num(u.hp), nv = clamp(r2(old + num(el.dataset.d)), 0, num(u.maxhp)); if (nv === old) { toast(num(el.dataset.d) > 0 ? "Already at full HP" : "Already at 0 HP"); return; }
    setHp(d, u, nv); addLog(d, `${u.name}: HP ${fx(old)} → ${fx(nv)}${lost(u) ? " (destroyed)" : ""}`, "hp"); snap(d); save(); render();
  },
  mapTrTray: () => { const x = mpTrFind(mpTS); if (x && x.uid) A.tray({ dataset: { id: x.uid } }); },
  mapTrPin: () => { const x = mpTrFind(mpTS); if (x) mpPinpoint(x); },
  mapTrCalc: () => { const x = mpTrFind(mpTS), u = x && x.uid && D().units.find(y => y.id === x.uid); if (u) toCalc(u.id); }   /* one click: the unit goes in the calculator and the page switches */
});
/* Pinpoint: the camera glides to the unit (zooming in if the view is wide) and a ring pulses on it three times. The animation is skipped when the person asked for less motion. */
const mpReduced = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
function mpFlyTo(cx, cy, w) {
  const svg = document.querySelector(".mapsvg"); if (!svg || !MPV) return;
  const keep = MPV; MPV = { x: cx - w / 2, y: cy - w * 9 / 32, w, h: w * 9 / 16 }; mpClampView(); const to = MPV; MPV = keep;   /* where the view may actually end up (the map edge stops it) */
  const from = { x: MPV.x, y: MPV.y, w: MPV.w }, id = ++mpFly, t0 = performance.now(), ms = mpReduced() ? 0 : 420;
  const step = now => {
    if (id !== mpFly || !svg.isConnected) return;   /* a drag or the wheel took over */
    const u = ms ? Math.min(1, (now - t0) / ms) : 1, k = 1 - Math.pow(1 - u, 3);
    MPV.x = from.x + (to.x - from.x) * k; MPV.y = from.y + (to.y - from.y) * k; MPV.w = from.w + (to.w - from.w) * k; MPV.h = MPV.w * 9 / 16; mpSetView(svg);
    if (u < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function mpPinpoint(x) {
  const g = mpGeo(S.topic), p = mpXY(g, x.lat, x.lon), fit = mpFit(g);
  mpFlyTo(p[0], p[1], Math.min(MPV.w, fit.w / 3));
  mpPing = x.id; clearTimeout(mpPingT); mpPingT = setTimeout(() => { mpPing = null; }, 2800); mpTroopsRedraw();
}
/* put a new troop down where the map was clicked: a unit joins the chair's forces (so the combat calculator can use it) and a marker goes on the map */
function mpTroopPlaceAt(lat, lon) {
  const d = D(), u = mpPlace && d.units.find(y => y.id === mpPlace); if (!u || mpTroops().some(x => x.uid === u.id)) return false;
  const x = { id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), uid: u.id, name: u.name, code: MPCODES.includes(u.tcode) ? u.tcode : "INF", aff: mpAffOf(u.side), side: u.side, lat, lon, hp: num(u.hp), maxhp: num(u.maxhp), atk: num(u.atk), mov: num(u.mov), rng: num(u.rng), lost: false };
  (TR[S.topic] = TR[S.topic] || []).push(x); mpAg[x.id] = { name: u.name, hp: num(u.hp), maxhp: num(u.maxhp), atk: num(u.atk), mov: num(u.mov), rng: num(u.rng) }; mpRG = null; render(); mpTroopSave(); return true;
}

/* drag a kind of troop from the list onto the map */
(function () {
  document.addEventListener("pointerdown", e => {
    const it = e.target.closest && e.target.closest(".trt[data-id]"); if (!it || e.button || ROLE === "delegate") return;
    mpLDrag = { id: it.dataset.id, x: e.clientX, y: e.clientY, moved: false, src: it, ghost: null };
  });
  document.addEventListener("pointermove", e => {
    const d = mpLDrag; if (!d) return; if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    if (!d.moved) { d.moved = true; mpDragged = true; d.ghost = document.createElement("img"); d.ghost.src = d.src.querySelector("img").src; d.ghost.className = "trt-ghost"; document.body.appendChild(d.ghost); document.body.classList.add("trt-dragging"); }
    d.ghost.style.transform = `translate(${e.clientX - 40}px, ${e.clientY - 40}px)`; e.preventDefault();
  });
  const end = e => {
    const d = mpLDrag; if (!d) return; mpLDrag = null; if (!d.moved) return;
    d.ghost.remove(); document.body.classList.remove("trt-dragging"); const under = document.elementFromPoint(e.clientX, e.clientY), svg = under && under.closest && under.closest(".mapsvg");
    if (svg) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()), ll = mpLL(mpGeo(S.topic), q.x, q.y); mpPlace = d.id; mpTroopPlaceAt(ll[0], ll[1]); mpPlace = null; render(); }
  };
  document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end);
})();

/* drag a troop that is already on the map (chairs) */
(function () {
  const toSvg = (svg, e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  document.addEventListener("pointerdown", e => {
    const h = e.target.closest && e.target.closest(".trp"), s = e.target.closest && e.target.closest(".mapsvg"); if (!h || !s || e.button || ROLE === "delegate" || false) return;
    const x = mpTrFind(h.dataset.id), q = toSvg(s, e), p = x ? mpXY(mpGeo(S.topic), x.lat, x.lon) : [q.x, q.y];
    mpTDrag = { id: h.dataset.id, x: e.clientX, y: e.clientY, moved: false, s, off: [p[0] - q.x, p[1] - q.y] }; mpPressed = Date.now(); mpFly++; e.stopPropagation(); e.preventDefault();   /* off: where on the marker it was grabbed, so it does not jump to the pointer */
  }, true);
  document.addEventListener("pointermove", e => {
    if (!mpTDrag) return; if (e.pointerType === "mouse" && e.buttons === 0) { endDrag(); return; }   /* let go somewhere we were not told about */
    if (!mpTDrag.s.isConnected) return; if (!mpTDrag.moved && Math.hypot(e.clientX - mpTDrag.x, e.clientY - mpTDrag.y) < mpSlop(e)) return; mpTDrag.moved = true; mpDragged = true;
    const x = mpTrFind(mpTDrag.id); if (!x) return; const q = toSvg(mpTDrag.s, e), m = Math.min(MPV.w, MPV.h) * 0.04; q.x = Math.max(MPV.x + m, Math.min(MPV.x + MPV.w - m, q.x)); q.y = Math.max(MPV.y + m, Math.min(MPV.y + MPV.h - m, q.y)); q.x += mpTDrag.off[0]; q.y += mpTDrag.off[1]; const ll = mpLL(mpGeo(S.topic), q.x, q.y);   /* it cannot be dragged off the edge of what you can see */
     x.lat = ll[0]; x.lon = ll[1];
    const el = [...mpTDrag.s.querySelectorAll(".trp")].find(e => e.dataset.id === x.id); if (el) el.setAttribute("transform", `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`); else mpTroopsRedraw();   /* move the one marker, not all of them */
  });
  const endDrag = () => { const d = mpTDrag; mpPressed = 0; if (!d) return; mpTDrag = null; if (d.moved) { mpRG = null; mpTS = d.id; render(); mpTroopSave(); } };
  document.addEventListener("pointerup", endDrag); document.addEventListener("pointercancel", endDrag); window.addEventListener("blur", endDrag);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && mpPlace) { mpPlace = null; if (typeof UI !== "undefined" && UI.page === "map") render(); } });
})();
/* the troops list and this device's forces stay in step while you are on any page */
setInterval(() => { if (typeof ROLE !== "undefined" && ROLE !== "admin" && mpTLoaded && !document.hidden && !mpTDrag) mpTroopsLoad(); }, 10000);
