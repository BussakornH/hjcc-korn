"use strict";
/* SENTINEL battle map: the theatre map with historical borders, key cities and the battle lines. Chairs add, remove and reshape
   the lines (they are stored on the server, api/lines.js, so every screen shows the same ones); delegates watch.
   Loaded before app.js; it uses app.js helpers (esc, ico, seg, toast, S, UI, ROLE) only when a page is drawn. */
const MPCFG = {
  t1: { lon: [-7, 10], lat: [41.5, 53], url: "borders-1400.json", side: { "France": "L", "English territory": "R" },
    rename: { "English territory": "Kingdom of England", "France": "Kingdom of France", "Britany": "Duchy of Brittany", "Castile": "Crown of Castile", "Aragón": "Crown of Aragon", "Navarre": "Kingdom of Navarre", "Scotland": "Kingdom of Scotland" } },
  t2: { lon: [-11, 48], lat: [30, 63.5], url: "borders-1914.json", rename: { "United Kingdom of Great Britain and Ireland": "United Kingdom" },
    side: { "France": "L", "United Kingdom of Great Britain and Ireland": "L", "Russian Empire": "L", "Kingdom of Italy": "L", "Belgium": "L", "Serbia": "L", "Romania": "L", "Greece": "L", "German Empire": "R", "Austro-Hungarian Empire": "R", "Ottoman Empire": "R", "Bulgaria": "R" } }
};
let mpPD = null, mpTerrOpen = false, mpDEM = {}, MPREL = {}, mpTD = null, mpTerr = true, mpCity = null, MPLAND = null, MPB = {}, LN = null, MPBASE = {}, MPV = null, MPT = null, mpTool = "edit", mpSel = null, mpVx = null, mpDraft = [], mpLoad = 0, mpDragged = false, mpDrag = null, mpPressed = 0, mpFly = 0, mpPt = null, mpPtNew = null, PTS = { t1: [], t2: [] }, mpPtAt = 0;

/* every map is 1000 units wide, so text and points look the same size on both topics; sc is units per degree of latitude */
const mpGeo = t => { const c = MPCFG[t], k = Math.cos(((c.lat[0] + c.lat[1]) / 2) * Math.PI / 180), sc = 1000 / ((c.lon[1] - c.lon[0]) * k); return { c, k, sc, lon0: c.lon[0], top: c.lat[1], W: 1000, H: (c.lat[1] - c.lat[0]) * sc }; };
const mpXY = (g, lat, lon) => [(lon - g.lon0) * g.k * g.sc, (g.top - lat) * g.sc];
const mpLL = (g, x, y) => [Math.round((g.top - y / g.sc) * 1000) / 1000, Math.round((g.lon0 + x / (g.k * g.sc)) * 1000) / 1000];
const mpPath = (g, pts) => "M" + pts.map(p => mpXY(g, p[0], p[1]).map(v => v.toFixed(0)).join(" ")).join("L");
/* the map window is always 16:9 (a screen): it shows a band of the theatre across its full width, centred; zoom out to see all of it */
/* how far a press may wander and still count as a click: a hand on a mouse or a finger always moves a little, and a unit that will not select because the press was read as a pan is worse than a pan that starts a few pixels late */
const mpSlop = e => e && e.pointerType && e.pointerType !== "mouse" ? 14 : 10;
const mpFit = g => { const h = g.W * 9 / 16; return { x: 0, y: (g.H - h) / 2, w: g.W, h }; };

function mpLoadData(quiet) {
  const t = S.topic, c = MPCFG[t];
  const need = MPLAND ? Promise.resolve() : fetch("land.json").then(r => r.json()).then(j => { MPLAND = j.rings; }, () => { MPLAND = []; });
  const bor = MPB[t] ? Promise.resolve() : fetch(c.url).then(r => r.json()).then(j => { MPB[t] = j; }, () => { MPB[t] = { f: [] }; });
  const terr = mpTD ? Promise.resolve() : fetch("terrain-data.json").then(r => r.json()).then(j => { mpTD = j; }, () => { mpTD = { rivers: [], ranges: [] }; });
  const dem = MPREL[t] ? Promise.resolve() : (mpDEM[t] ? Promise.resolve() : mpDemLoad(t)).then(() => mpRelief(t)).then(u => { MPREL[t] = u; }, () => { MPREL[t] = "none"; });
  const gen = mpTGen, trp = SentinelAuth.api("GET", "/api/troops").then(r => r.ok ? r.json() : null).then(j => { if (j && !mpTPend && !mpTDrag && gen === mpTGen) { mpTrAdopt(j); TRMINE = j.mine || {}; mpTroopSync(); } }, () => {});
  const lines = SentinelAuth.api("GET", "/api/lines").then(r => r.ok ? r.json() : Promise.reject());
  return Promise.all([need, bor, lines, terr, dem, trp]).then(a => {
    LN = a[2]; mpLoad = 2; mpPtAdopt(a[2]);
    if (mpSel && !LN[t].some(l => l.id === mpSel)) { mpSel = null; mpVx = null; }
    if (UI.page === "map" && !(quiet && (mpDrag || mpPD || mpDraft.length || document.querySelector("#page :focus")))) render();
  }, () => { mpLoad = -1; if (UI.page === "map") render(); });
}
/* weak / fortified points: a circle on the map. Units whose marker stands inside one take +2 (weak) or -5 (fortified) damage, see zoneNet() in app.js */
const PT_KM = 111.32, PT_ICON = { weak: "Weak point", fort: "Fortified point" };
function mpPtAdopt(j) { if (j && j.points) PTS = { t1: j.points.t1 || [], t2: j.points.t2 || [] }; if (j && j.turn) TURN = Object.assign({}, TURN, j.turn); mpPtAt = Date.now(); }
/* ---------- the turn order (shared through api/lines.js) ----------
   A round is eight turns: One, Two, Two, One, One, Two, Two, One. Cabinet One is a side (Allied by default), Cabinet Two the other.
   step 0-7 is the turn being played; 8 means the round is over and the next press starts the next round.
   The game opens with a Prep phase (prep: true) before round 1, turn 1: nobody's turn, both sides set up, and stealth does not hide anyone. */
let mpHbOpen = false;
let TURN = { t1: { one: "me", round: 1, step: 0, prep: true }, t2: { one: "me", round: 1, step: 0, prep: true } }, mpTurnBusy = false;
const TURN_ORDER = [1, 2, 2, 1, 1, 2, 2, 1];
const turnOf = t => TURN[t] || { one: "me", round: 1, step: 0, prep: true };
const turnPrep = t => !!turnOf(t).prep;
const turnSideAt = (t, i) => { const v = turnOf(t), two = v.one === "me" ? "foe" : "me"; return TURN_ORDER[i] === 1 ? v.one : two; };
const turnNow = t => { const v = turnOf(t); return !v.prep && v.step < 8 ? turnSideAt(t, v.step) : null; };   /* the side whose turn it is, or null in Prep and between rounds */
function mpTurnBar(t) {
  const v = turnOf(t), pr = !!v.prep, cur = !pr && v.step < 8 ? v.step : -1, nm = sd => sideLbl(sd).replace(/ Powers$/, ""), now = turnNow(t), nx = pr ? turnSideAt(t, 0) : v.step < 7 ? turnSideAt(t, v.step + 1) : null;
  const segs = TURN_ORDER.map((n, i) => { const sd = turnSideAt(t, i), st = !pr && i < v.step ? "done" : i === cur ? "now" : "next"; return `<li class="tb-s tb-${st} tb-${sd}" title="Turn ${i + 1}: ${esc(sideLbl(sd))} (Cabinet ${n === 1 ? "One" : "Two"})${st === "done" ? ", played" : st === "now" ? ", now" : ""}" aria-current="${st === "now" ? "step" : "false"}"><span>${i + 1}</span><b>${esc(nm(sd))}</b></li>`; }).join("");
  const prepSeg = v.round === 1 ? `<li class="tb-s tb-prep tb-${pr ? "now" : "done"}" title="Prep phase: both sides set up before turn 1${pr ? ", now" : ", played"}" aria-current="${pr ? "step" : "false"}"><span>P</span><b>Prep</b></li>` : "";
  const label = pr ? `<b>Prep phase · <em class="tb-who">Both sides</em></b><small>Set up, then turn 1: ${esc(nm(nx))}</small>` : now ? `<b>Turn ${v.step + 1}/8 · <em class="tb-who tb-${now}">${esc(nm(now))}</em></b><small>${nx ? "Next: " + esc(nm(nx)) : "Last turn of the round"}</small>` : `<b>Round ${v.round} complete</b><small>All eight turns played</small>`;
  const one = `<select class="sel tb-one" data-c="mapTurnOne" aria-label="Cabinet One (goes first)" title="Cabinet One (goes first)">${["me", "foe"].map(sd => `<option value="${sd}" ${v.one === sd ? "selected" : ""}>One: ${esc(nm(sd))}</option>`).join("")}</select>`;
  return `<div class="tb-row" role="group" aria-label="Turn order"><div class="tb-l"><span class="tb-r">Round ${v.round}</span><div class="tb-t">${label}</div></div><ol class="tb-segs${prepSeg ? " has-prep" : ""}">${prepSeg}${segs}</ol><div class="tb-act">${one}<button class="btn sm" data-a="mapTurn" data-op="back" ${pr ? "disabled" : ""}>Back</button><button class="btn sm plain" data-a="mapTurnReset" title="Back to the Prep phase before round 1">Reset</button><button class="btn sm primary tb-next" data-a="mapTurn" data-op="next">${pr ? "Start turn 1" : now ? (v.step === 7 ? "Finish round" : "Next turn") : `Start round ${v.round + 1}`}</button></div></div>`;
}
function mpTurnSend(op) {
  if (mpTurnBusy) return; const t = S.topic, v = turnOf(t); mpTurnBusy = true;
  SentinelAuth.api("POST", "/api/lines", { topic: t, turn: op, from: v.prep ? "prep" : v.round + ":" + v.step }).then(r => r.ok ? r.json() : Promise.reject()).then(j => {
    const moved = JSON.stringify(j.turn) !== JSON.stringify(v); TURN = Object.assign({}, TURN, { [t]: j.turn });
    const now = turnNow(t); if (now) { UI.mpSide = now; saveUI(); }   /* the forces panel follows the side whose turn it is */
    if (!moved && (op === "next" || op === "back")) toast("Another chair moved the turn just now");
    mpTS = null; mpRG = null; render();
  }).catch(() => toast("Could not change the turn, try again")).then(() => { mpTurnBusy = false; });
}
/* the combat calculator needs the points even when the map was never opened */
function mpPointsLoad() { mpPtAt = Date.now(); return SentinelAuth.api("GET", "/api/lines").then(r => r.ok ? r.json() : null).then(j => { if (j && !mpPtDirty) { const o = JSON.stringify(PTS); mpPtAdopt(j); if (o !== JSON.stringify(PTS) && UI.page !== "map") render(); } }, () => {}); }
let mpPtDirty = 0;
function mpPtSave() {
  mpPtDirty = 1; return SentinelAuth.api("POST", "/api/lines", { topic: S.topic, points: PTS[S.topic] }).then(r => { if (!r.ok) throw new Error("save"); mpPtDirty = 0; }).catch(() => { mpPtDirty = 0; toast("Could not save the points, try again"); mpLoadData(); });
}
const mpKm = (a, b, c, d) => { const R = 6371, q = Math.PI / 180, x = Math.sin((c - a) * q / 2) ** 2 + Math.cos(a * q) * Math.cos(c * q) * Math.sin((d - b) * q / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
function mpPointsSvg(t) {
  const g = mpGeo(t); let o = "";
  (PTS[t] || []).forEach(q => {
    const p = mpXY(g, q.lat, q.lon), r = q.r / PT_KM * g.sc, on = q.id === mpPt, ed = ROLE !== "delegate";
    const glyph = q.kind === "weak"
      ? `<path d="M-13 -15H13V3C13 11 6 16 0 19C-6 16 -13 11 -13 3Z" class="pt-sh"/><path d="M2 -12L-4 -1L3 1L-3 14" class="pt-cr"/>`
      : `<path d="M-14 15V-6H-9V-11H-4V-6H4V-11H9V-6H14V15Z" class="pt-sh"/><path d="M-4 15V5A4 4 0 0 1 4 5V15Z" class="pt-door"/>`;
    o += `<g class="pt pt-${q.kind}${on ? " on" : ""}" transform="translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})"><circle class="pt-c" r="${r.toFixed(1)}"/><g class="pt-i" data-a="mapPt" data-id="${esc(q.id)}"><circle class="pt-hit" r="22"/>${glyph}</g>${on && ed && mpTool === "pts" ? `<g class="pt-rg" transform="translate(${r.toFixed(1)} 0)"><g class="pt-rh" data-id="${esc(q.id)}"><circle class="pt-rhit" r="14"/><circle class="pt-rd" r="6"/></g></g>` : ""}${q.name && (on || ed || true) ? `<text class="pt-n" y="34">${esc(q.name)}</text>` : ""}</g>`;
  });
  return o;
}
const mpPointsRedraw = () => { const e = document.getElementById("mp-points"); if (e) e.innerHTML = mpPointsSvg(S.topic); };
function mpSave() {
  return SentinelAuth.api("POST", "/api/lines", { topic: S.topic, lines: LN[S.topic] }).then(r => { if (!r.ok) throw new Error("save"); }).catch(() => { toast("Could not save the lines, try again"); mpLoadData(); });
}

/* the ground itself: height tint (blue-green lowlands up to pale rock and snow), light from the north-west, and a contour line every 200 m (heavier every 1000 m).
   Painted once per map from dem-t1.bin / dem-t2.bin into one picture (grids made by scripts/dem.js). */
const MPRAMP = [[0, [22, 74, 82]], [80, [30, 100, 96]], [250, [46, 128, 102]], [500, [76, 154, 114]], [900, [120, 174, 130]], [1400, [152, 182, 162]], [2000, [174, 186, 184]], [2800, [208, 215, 224]], [4000, [244, 247, 252]]];
/* the height grid is a PNG (metres + 32 in red and green); read it back through a canvas */
function mpDemLoad(t) {
  return fetch("dem.json").then(r => r.json()).then(m => new Promise((ok, no) => {
    const im = new Image(), q = m[t]; im.onload = () => {
      const cv = document.createElement("canvas"); cv.width = q.w; cv.height = q.h; const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(im, 0, 0); const px = cx.getImageData(0, 0, q.w, q.h).data, a = new Int16Array(q.w * q.h);
      for (let i = 0; i < a.length; i++) a[i] = ((px[i * 4] << 8) | px[i * 4 + 1]) - 32;
      mpDEM[t] = { w: q.w, h: q.h, lon0: q.lon0, lat1: q.lat1, st: q.st, a }; ok();
    }; im.onerror = () => { mpDEM[t] = { w: 0 }; ok(); }; im.src = "dem-" + t + ".png";
  }), () => { mpDEM[t] = { w: 0 }; });
}
function mpRelief(t) {
  const d = mpDEM[t]; if (!d || !d.w) return Promise.resolve("none");
  const g = mpGeo(t), c = g.c, L0 = d.lon0, T0 = d.lat1, ST = d.st, cw = 4096, ch = Math.round(cw * g.H / g.W), el = new Float32Array(cw * ch);
  const dl = (c.lon[1] - c.lon[0]) / cw, dt = (c.lat[1] - c.lat[0]) / ch;
  for (let j = 0; j < ch; j++) {
    const gy = (T0 - (c.lat[1] - (j + 0.5) * dt)) / ST - 0.5, y0 = Math.max(0, Math.min(d.h - 2, Math.floor(gy))), fy = Math.max(0, Math.min(1, gy - y0));
    for (let i = 0; i < cw; i++) {
      const gx = (c.lon[0] + (i + 0.5) * dl - L0) / ST - 0.5, x0 = Math.max(0, Math.min(d.w - 2, Math.floor(gx))), fx = Math.max(0, Math.min(1, gx - x0)), k = y0 * d.w + x0;
      const a = Math.max(0, d.a[k]), b = Math.max(0, d.a[k + 1]), e = Math.max(0, d.a[k + d.w]), f = Math.max(0, d.a[k + d.w + 1]);
      el[j * cw + i] = (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy;
    }
  }
  const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch; const cx = cv.getContext("2d"), im = cx.createImageData(cw, ch), px = im.data;
  const col = e => { let i = 1; while (i < MPRAMP.length - 1 && e > MPRAMP[i][0]) i++; const a = MPRAMP[i - 1], b = MPRAMP[i], u = Math.max(0, Math.min(1, (e - a[0]) / (b[0] - a[0]))); return [a[1][0] + (b[1][0] - a[1][0]) * u, a[1][1] + (b[1][1] - a[1][1]) * u, a[1][2] + (b[1][2] - a[1][2]) * u]; };
  const mx = 111320 * Math.cos(((c.lat[0] + c.lat[1]) / 2) * Math.PI / 180) * dl, my = 111320 * dt, Lx = -0.54, Ly = 0.54, Lz = 0.643, INT = 200;
  for (let j = 1; j < ch - 1; j++) for (let i = 1; i < cw - 1; i++) {
    const n = j * cw + i, e = el[n], zx = (el[n + 1] - el[n - 1]) / (2 * mx) * 4, zy = (el[n - cw] - el[n + cw]) / (2 * my) * 4;
    const sh = (-zx * Lx - zy * Ly + Lz) / Math.sqrt(zx * zx + zy * zy + 1) / Lz, f = 0.4 + 0.6 * Math.max(0, Math.min(1.5, sh)), cl = col(e);
    let m = 1; const b0 = Math.floor(e / INT);
    if (b0 !== Math.floor(el[n + 1] / INT) || b0 !== Math.floor(el[n + cw] / INT)) m = (Math.max(b0, Math.floor(el[n + 1] / INT), Math.floor(el[n + cw] / INT)) % 5 === 0) ? 0.45 : 0.72;
    const o = n * 4; px[o] = Math.min(255, cl[0] * f * m); px[o + 1] = Math.min(255, cl[1] * f * m); px[o + 2] = Math.min(255, cl[2] * f * m); px[o + 3] = 255;
  }
  cx.putImageData(im, 0, 0);
  return new Promise(ok => cv.toBlob(b => ok(b ? URL.createObjectURL(b) : "none"), "image/png"));
}

/* everything that does not change while you edit: sea, land, borders, names, cities */
function mpBase(t) {
  if (MPBASE[t]) return MPBASE[t];
  const g = mpGeo(t), c = g.c, B = MPB[t];
  const inView = r => { let a = 1e9, b = -1e9, d = 1e9, e = -1e9; for (const p of r) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); d = Math.min(d, p[1]); e = Math.max(e, p[1]); } return !(b < c.lon[0] || a > c.lon[1] || e < c.lat[0] || d > c.lat[1]); };
  const ring = r => "M" + r.map(p => mpXY(g, p[1], p[0]).map(v => v.toFixed(0)).join(" ")).join("L") + "Z";
  /* each country is painted on its own, largest first, in a solid colour, so a small country covers the sliver where its neighbours' data overlaps it; everything is cut at the coast */
  const area = f => f.r.reduce((t, r) => { let a = 1e9, b = -1e9, d = 1e9, e = -1e9; for (const p of r) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); d = Math.min(d, p[1]); e = Math.max(e, p[1]); } return t + (b - a) * (e - d); }, 0);
  let countries = "", outl = "", names = ""; const seen = {};
  B.f.slice().sort((x, y) => area(y) - area(x)).forEach(f => {
    const sd = c.side[f.n] || "N", d = f.r.filter(inView).map(ring).join(""); if (d) { countries += `<path class="bd ${sd}" d="${d}" fill-rule="evenodd"/>`; outl += `<path class="bdl ${sd}" d="${d}"/>`; }
  });
  B.f.forEach(f => {
    const sd = c.side[f.n] || "N", nm = c.rename[f.n] || f.n; if (seen[nm] || !f.c) return; seen[nm] = 1;
    if (f.c[0] < c.lon[0] || f.c[0] > c.lon[1] || f.c[1] < c.lat[0] || f.c[1] > c.lat[1]) return;
    const p = mpXY(g, f.c[1], f.c[0]); names += `<text class="cn ${sd}" x="${p[0].toFixed(0)}" y="${p[1].toFixed(0)}">${esc(nm.toUpperCase())}</text>`;
  });
  const clip = B.f.map(f => f.r.filter(inView).map(ring).join("")).join("");
  return (MPBASE[t] = `<defs><clipPath id="mp-clip"><path d="${clip}"/></clipPath></defs><rect class="sea" x="${(-g.W * 2).toFixed(0)}" y="${(-g.W * 2).toFixed(0)}" width="${(g.W * 5).toFixed(0)}" height="${(g.W * 5).toFixed(0)}" data-a="mapBg"/>${countries}${MPREL[t] && MPREL[t] !== "none" ? `<g class="relief" clip-path="url(#mp-clip)"><image href="${MPREL[t]}" width="${g.W.toFixed(0)}" height="${g.H.toFixed(0)}" preserveAspectRatio="none"/></g>` : ""}<g class="bdls">${outl}</g>${mpTerrainSvg(g)}${names}`);
}
/* rivers, mountains, thick forest and marsh; drawn as a map would: curved rivers with a dark edge, peaks along the ranges, trees in the woods, reeds in the marsh.
   All of it is sized in map units, so it grows with the zoom, and the names show once you zoom in. */
function mpTerrainSvg(g) {
  const T = window.SENTINEL_TERRAIN; if (!T) return "";
  const xy = p => mpXY(g, p[0], p[1]), f1 = v => v.toFixed(1), inB = a => a.some(p => p[0] > g.c.lat[0] - 2 && p[0] < g.c.lat[1] + 2 && p[1] > g.c.lon[0] - 2 && p[1] < g.c.lon[1] + 2);
  /* a smooth curve through the points (Catmull-Rom as Béziers) */
  const curve = (a, closed) => {
    const P = a.map(xy), n = P.length, at = i => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]; let d = "M" + f1(P[0][0]) + " " + f1(P[0][1]);
    for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2); d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`; }
    return d + (closed ? "Z" : "");
  };
  const mid = a => xy(a[Math.floor(a.length / 2)]);
  const defs = `<defs>
    <pattern id="pt-tree" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2.4" cy="2.6" r="1.9" fill="#58c283"/><circle cx="6.9" cy="6.9" r="1.9" fill="#58c283"/><circle cx="6.9" cy="2" r="1.3" fill="#3f9d66"/><circle cx="2.2" cy="7" r="1.3" fill="#3f9d66"/></pattern>
    <pattern id="pt-marsh" width="8" height="7" patternUnits="userSpaceOnUse"><path d="M1 5V2M2.2 5V3M3.4 5V2" stroke="#7fe0dc" stroke-width=".7" fill="none"/><path d="M5 2h2" stroke="#4aa8b0" stroke-width=".7"/></pattern>
    <pattern id="pt-peak" width="10" height="8" patternUnits="userSpaceOnUse"><path d="M0.6 7L3 1.6L5.4 7Z" fill="#8f9bb3" stroke="#dfe7f5" stroke-width=".5" stroke-linejoin="round"/><path d="M5.6 7L8 2.4L10.4 7Z" fill="#8f9bb3" stroke="#dfe7f5" stroke-width=".5" stroke-linejoin="round"/><path d="M3 1.6L2.1 3.4L3 3L3.9 3.4Z" fill="#f2f6ff"/><path d="M8 2.4L7.2 4L8 3.6L8.8 4Z" fill="#f2f6ff"/></pattern></defs>`;
  let area = "", riv = "", nm = "";
  T.forests.filter(x => inB(x.p)).forEach(x => {
    const c = x.p.map(xy).reduce((s, p) => [s[0] + p[0] / x.p.length, s[1] + p[1] / x.p.length], [0, 0]), d = curve(x.p, true);
    area += `<path class="tr-${x.k}-b" d="${d}"/><path d="${d}" fill="url(#pt-${x.k === "marsh" ? "marsh" : "tree"})"/><path class="tr-${x.k}" d="${d}"/>`; nm += `<text class="tn" x="${f1(c[0])}" y="${f1(c[1])}">${esc(x.n)}</text>`;
  });
  const D = mpTD || { rivers: [], ranges: [] }, plain = a => "M" + a.map(xy).map(p => f1(p[0]) + " " + f1(p[1])).join("L");
  const ctr = a => a.map(xy).reduce((q, p) => [q[0] + p[0] / a.length, q[1] + p[1] / a.length], [0, 0]), flat = v => String(v || "").normalize("NFD").replace(/[^a-z]/gi, "").toLowerCase();
  /* real ranges first (Natural Earth), then the few that file lacks */
  D.ranges.concat(T.ranges.filter(x => x.poly)).filter(x => inB(x.p)).forEach(x => { const c = ctr(x.p); if (x.n) nm += `<text class="tn" x="${f1(c[0])}" y="${f1(c[1])}">${esc(x.n)}</text>`; });
  T.ranges.filter(x => !x.poly && inB(x.p)).forEach(x => {
    const m = mid(x.p); nm += `<text class="tn" x="${f1(m[0])}" y="${f1(m[1] + x.w * g.sc * 0.8)}">${esc(x.n)}</text>`;
  });
  /* rivers: the real courses, then the smaller ones the wars turned on (only where the real file has no river of that name) */
  const have = new Set(D.rivers.map(x => flat(x.n)).filter(Boolean)); if (have.has("rhein")) have.add("rhine"); if (have.has("rhne")) have.add("rhone"); if (have.has("dnepre")) have.add("dnieper"); if (have.has("dicle")) have.add("tigris"); if (have.has("firat")) have.add("euphrates");
  const named = {}, river = (x, d) => { riv += `<path class="tr-edge${x.w > 1 ? " big" : ""}" d="${d}"/><path class="tr-riv${x.w > 1 ? " big" : ""}" d="${d}"/>`; const k = flat(x.n); if (x.n && !named[k]) { named[k] = 1; const m = mid(x.p); nm += `<text class="tn rv" x="${f1(m[0] + 3)}" y="${f1(m[1])}">${esc(x.n)}</text>`; } };
  D.rivers.filter(x => inB(x.p)).forEach(x => river(x, plain(x.p)));
  T.rivers.filter(x => inB(x.p) && !have.has(flat(x.n))).forEach(x => river(x, curve(x.p, false)));
  return `<g class="terr">${defs}<g clip-path="url(#mp-clip)">${area}</g>${riv}${nm}</g>`;
}

/* the key cities, coloured by whichever side the chairs gave them to (their own side until then) */
function mpCitiesSvg(t) {
  const g = mpGeo(t), ov = (LN.citySides && LN.citySides[t]) || {}, C = window.SENTINEL_CITIES || {}; let o = "";
  const dot = (nm, lat, lon, rank, def) => {
    const p = mpXY(g, lat, lon); if (p[0] < 0 || p[0] > g.W || p[1] < 0 || p[1] > g.H) return;
    o += `<g class="cty r${rank} ${ov[nm] || def}${nm === mpCity ? " on" : ""}" data-a="mapCity" data-n="${esc(nm)}" data-x="${p[0].toFixed(1)}" data-y="${p[1].toFixed(1)}" transform="translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})"><circle/><text>${esc(nm)}</text></g>`;
  };
  if (t === "t1") (C.t1 || []).forEach((x, i) => dot(x[0], x[1], x[2], i < 15 ? 0 : 1, "n"));
  else (C.t2 || []).forEach(gr => gr.cities.forEach((x, i) => dot(x[0], x[1], x[2], i ? 1 : 0, gr.bloc === "L" ? "me" : gr.bloc === "R" ? "foe" : "n")));
  return o;
}

/* ---------- trenches ----------
   A trench is a battle line with kind "trench", a side ("me" / "foe") and a tier: frontline, support or backline. Each side digs its own.
   Troops go down where the chair puts them (the chairs move them into trenches), and a unit standing within trenchKm of a trench of its
   own side counts as in it: it takes trenchCut % less damage when attacked (the combat rules, app.js). */
const TR_TIER = { front: "Frontline", support: "Support", back: "Backline" }, TR_TIERS = ["front", "support", "back"];
const isTrench = l => !!l && l.kind === "trench";
let mpTrNew = { side: "me", tier: "front" };
const mpDrawing = () => mpTool === "draw" || mpTool === "trench";
const trName = (side, tier) => `${sideLbl(side).replace(/ Powers$/, "")} ${TR_TIER[tier].toLowerCase()} trench`;
/* nearest point of a line to (x, y) in map units: distance, the point, and how far along the line it is */
function mpNearOn(q, x, y) {
  let best = { d: Infinity, p: q[0], s: 0 }, run = 0;
  for (let i = 0; i < q.length - 1; i++) {
    const A = q[i], B = q[i + 1], vx = B[0] - A[0], vy = B[1] - A[1], L2 = vx * vx + vy * vy || 1, u = Math.max(0, Math.min(1, ((x - A[0]) * vx + (y - A[1]) * vy) / L2)), p = [A[0] + vx * u, A[1] + vy * u], d = Math.hypot(x - p[0], y - p[1]), len = Math.sqrt(L2);
    if (d < best.d) best = { d, p, s: run + len * u }; run += len;
  }
  return best;
}
/* the trench of the troop's own side it stands in (within the rules' trenchKm), or null. Ships and aircraft are never in a trench. */
function mpTrenchOf(t, x) {
  if (!x || mpDomain(x.code) !== "land" || typeof LN === "undefined" || !LN || !LN[t]) return null;
  const g = mpGeo(t), kmU = 111.2 / g.sc, p = mpXY(g, x.lat, x.lon), R = (S.topics[t] && S.topics[t].rules) || {}, km = num(R.trenchKm, 10);
  let best = null, bd = Infinity;
  LN[t].forEach(l => { if (!isTrench(l) || l.side !== x.side) return; const n = mpNearOn(l.pts.map(a => mpXY(g, a[0], a[1])), p[0], p[1]); if (n.d < bd) { bd = n.d; best = l; } });
  return best && bd * kmU <= km ? best : null;
}

/* the battle lines, drawn on top; redrawn alone while you drag a point */
/* a line that comes back to where it began is an area (a landing zone): its inside takes the colour */
const mpClosed = (g, l) => { if (l.pts.length < 4) return false; const a = mpXY(g, l.pts[0][0], l.pts[0][1]), b = mpXY(g, l.pts[l.pts.length - 1][0], l.pts[l.pts.length - 1][1]); return Math.hypot(a[0] - b[0], a[1] - b[1]) < 40; };
function mpLinesSvg(t) {
  const g = mpGeo(t), edit = ROLE !== "delegate" && mpTool === "edit", hr = 8;
  let o = "";
  /* occupied ground: the line splits the map, and each side takes a colour (west/east for a front that runs north-south) */
  (LN[t] || []).forEach(l => {
    if (!l.zone || isTrench(l)) return;
    if (mpClosed(g, l)) { o += `<g clip-path="url(#mp-clip)" class="zn"><path class="${l.zone === "w" ? "zn-me" : "zn-foe"}" d="M${l.pts.map(p => mpXY(g, p[0], p[1]).map(v => v.toFixed(0)).join(" ")).join("L")}Z"/></g>`; return; }
    let q = l.pts.map(p => mpXY(g, p[0], p[1])); if (q[0][1] > q[q.length - 1][1]) q = q.reverse();
    const f = n => n.toFixed(0), body = q.map(p => f(p[0]) + " " + f(p[1])).join("L"), a = q[0], z = q[q.length - 1];
    const west = `M0 0L${f(a[0])} 0L${body}L${f(z[0])} ${f(g.H)}L0 ${f(g.H)}Z`, east = `M${f(g.W)} 0L${f(a[0])} 0L${body}L${f(z[0])} ${f(g.H)}L${f(g.W)} ${f(g.H)}Z`;
    o += `<g clip-path="url(#mp-clip)" class="zn"><path class="zn-me" d="${l.zone === "w" ? west : east}"/><path class="zn-foe" d="${l.zone === "w" ? east : west}"/></g>`;
  });
  (LN[t] || []).forEach(l => {
    const d = mpPath(g, l.pts), on = l.id === mpSel, pts = l.pts.map(p => mpXY(g, p[0], p[1]));
    const tr = isTrench(l);
    o += `<g class="ln${on ? " on" : ""}${tr ? ` tr tr-${l.side} tr-${l.tier}` : ""}"><path class="ln-h" d="${d}"/>${tr ? `<path class="tr-b" d="${d}"/>` : ""}<path class="ln-l" d="${d}"/><path class="ln-hit" d="${d}" data-a="mapLine" data-id="${esc(l.id)}"/>`;
    [pts[0], pts[pts.length - 1]].forEach(p => { o += `<circle class="ln-e" cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="6"/>`; });
    const mid = pts[Math.floor(pts.length / 2)]; o += `<text class="ln-t" x="${mid[0].toFixed(0)}" y="${(mid[1] - 12).toFixed(0)}">${esc(l.name)}${tr ? ` · ${TR_TIER[l.tier]}` : ""}</text>`;
    if (on && edit) {
      pts.slice(0, -1).forEach((p, i) => { const q = pts[i + 1]; o += `<circle class="vm" data-i="${i}" cx="${((p[0] + q[0]) / 2).toFixed(0)}" cy="${((p[1] + q[1]) / 2).toFixed(0)}" r="${hr - 3}"/>`; });
      pts.forEach((p, i) => { o += `<circle class="vh${i === mpVx ? " on" : ""}" data-a="mapVx" data-i="${i}" cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="${hr}"/>`; });
    }
    o += "</g>";
  });
  if (mpDraft.length) {
    const pts = mpDraft.map(p => mpXY(g, p[0], p[1]));
    o += `<g class="ln draft${mpTool === "trench" ? ` tr tr-${mpTrNew.side} tr-${mpTrNew.tier}` : ""}"><path class="ln-l" d="${mpPath(g, mpDraft)}"/>${pts.map(p => `<circle class="vh" cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="${hr}"/>`).join("")}</g>`;
  }
  return o;
}
/* a yes/no box (the browser's own confirm is blocked in some windows) */
function mpAsk(title, text, label, cb) { UI.askCb = cb; openModal(`<h2>${esc(title)}</h2><p class="muted" style="margin-top:10px">${esc(text)}</p><div class="m-act"><button class="btn" data-a="modalClose">Cancel</button><button class="btn danger" data-a="mapYes">${esc(label)}</button></div>`); }
/* laying down or taking back a point only redraws the line and the counter, not the whole page (that flashed) */
function mpDraftUi() {
  mpRedrawLines(); const p = document.querySelector(".mp-bar [data-a=mapFinish]"); if (!p) return;
  p.disabled = mpDraft.length < 2; document.querySelector(".mp-bar [data-a=mapUndoPt]").disabled = !mpDraft.length; const b = p.closest(".mp-card").querySelector(".mp-n"); if (b) b.textContent = plural(mpDraft.length, "point");
}
/* a redraw of the map page keeps the live map (borders, relief, terrain) and swaps only the layers that change: rebuilding the picture made the whole map flash */
/* bring the live map up to date from a freshly built one: its attributes and its layers (lines, reach, points, cities, troops), changing only
   the elements that differ, so markers that did not move are left alone (re-creating every troop image on each refresh made the map flash) */
function mpSyncSvg(old, n) {
  ["viewBox", "data-z", "data-tool", "data-terr"].forEach(a => { const v = n.getAttribute(a); if (old.getAttribute(a) !== v) old.setAttribute(a, v); });
  /* each layer remembers the markup it was last built from: the city names are moved about after drawing (mpLabels), so comparing the live layer would always differ */
  const memo = old._lay || (old._lay = {});
  ["mp-lines", "mp-range", "mp-points", "mp-cities", "mp-troops"].forEach(id => { const a = old.querySelector("#" + id), b = n.querySelector("#" + id); if (!a || !b) return; const h = b.innerHTML; if (memo[id] === h) return; memo[id] = h; if (!a.isEqualNode(b)) domMorphKids(a, b); });
}
const mpRedrawLines = () => { const e = document.getElementById("mp-lines"); if (e) e.innerHTML = mpLinesSvg(S.topic); };
const mpZoomAttr = svg => { if (svg && MPV) { svg.setAttribute("data-z", mpGeo(S.topic).W / MPV.w > 1.8 ? "1" : "0"); mpLabelsSoon(svg); } };
/* city names keep one size on screen at every zoom, and each takes the first free side (right, left, above, below); one that fits nowhere hides until you zoom in */
let mpLT = 0;
const mpLabelsSoon = svg => { cancelAnimationFrame(mpLT); mpLT = requestAnimationFrame(() => mpLabels(svg)); };
function mpLabels(svg) {
  if (!svg || !svg.isConnected || !MPV) return;
  const bw = svg.getBoundingClientRect().width; if (!bw) return; const k = MPV.w / bw; svg.style.setProperty("--k", k.toFixed(4)); const sa = (e, a, v) => { if (e.getAttribute(a) !== v) e.setAttribute(a, v); };   /* only touch what changed: setting the same value still costs a style pass */
  svg.querySelectorAll("pattern").forEach(q => sa(q, "patternTransform", "scale(" + (k * 1.8).toFixed(4) + ")"));
  const placed = [], box = (x, y, w, h) => ({ x, y, w, h }), hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  [...svg.querySelectorAll(".cty")].sort((a, b) => (a.classList.contains("r0") ? 0 : 1) - (b.classList.contains("r0") ? 0 : 1)).forEach(g => {
    const t = g.querySelector("text"); if (!t) return; if (g.classList.contains("r1") && svg.getAttribute("data-z") !== "1") return;
    const px = (Number(g.dataset.x) - MPV.x) / k, py = (Number(g.dataset.y) - MPV.y) / k, w = t.textContent.length * 6.9 + 4, h = 15;
    placed.push(box(px - 5, py - 5, 10, 10));   /* the dot itself is also in the way */
    const tries = [["start", 9, 4, box(px + 7, py - h / 2, w, h)], ["end", -9, 4, box(px - 7 - w, py - h / 2, w, h)], ["middle", 0, -9, box(px - w / 2, py - 7 - h, w, h)], ["middle", 0, 17, box(px - w / 2, py + 7, w, h)]];
    const ok = tries.find(c => c[3].x > 0 && c[3].x + c[3].w < bw && !placed.some(p => hit(p, c[3])));
    if (!ok) { sa(t, "visibility", "hidden"); return; }
    if (t.hasAttribute("visibility")) t.removeAttribute("visibility"); sa(t, "text-anchor", ok[0]); sa(t, "x", (ok[1] * k).toFixed(2)); sa(t, "y", (ok[2] * k).toFixed(2)); placed.push(ok[3]);
  });
}
function mpCitySet(side) {
  if (!mpCity) return; const t = S.topic, m = (LN.citySides = LN.citySides || {})[t] = LN.citySides[t] || {};
  if (side === "default") delete m[mpCity]; else m[mpCity] = side; render();
  SentinelAuth.api("POST", "/api/lines", { topic: t, citySide: { name: mpCity, side } }).then(r => { if (!r.ok) throw new Error("city"); }).catch(() => { toast("Could not save the city, try again"); mpLoadData(); });
}
const mpName = () => "Front line " + (LN[S.topic].length + 1);

function pgMap() {
  const chair = ROLE === "chair";
  const full = document.body.classList.contains("side-off");
  const head = `<div class="pg-head mp-head"><div><div class="eyebrow">${esc(topicLbl())}</div><h2 class="pg-h">War map</h2></div>${chair ? `<div class="pg-tools"><button class="btn" data-a="mapFull" aria-pressed="${full}">${full ? "Show menu" : "Hide menu"}</button><button class="btn primary" data-a="toCalc">${ico("swords")} Combat calculator</button></div>` : ""}</div>`;
  const t = S.topic;
  if (!LN || !MPLAND || !MPB[t] || !mpTD || !MPREL[t]) { if (mpLoad !== 1 && mpLoad !== -1) { mpLoad = 1; mpLoadData(); } return head + `<section class="panel"><p class="muted">${mpLoad === -1 ? "Could not load the map." : "Loading the map…"}</p></section>`; }
  const g = mpGeo(t);
    if (MPT !== t) { MPT = t; MPV = mpFit(g); mpTS = null; mpPick.clear(); mpSel = null; mpVx = null; mpDraft = []; mpTool = "edit"; }
  const live = document.querySelector("#page .mapsvg"), keepBase = !!(live && live.isConnected && live.dataset.t === t && live.dataset.base === "1");   /* the base map (sea, land, borders, terrain) never changes: the live one is kept, so it is not rebuilt or parsed again */
  const v = MPV, svg = `<svg class="mapsvg" data-t="${t}" data-base="${keepBase ? "0" : "1"}" viewBox="${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}" data-z="${g.W / v.w > 1.8 ? 1 : 0}" data-tool="${chair ? mpTool : ""}" data-terr="${mpTerr ? 1 : 0}" role="img" aria-label="Battle map">${keepBase ? "" : mpBase(t)}<g id="mp-lines">${mpLinesSvg(t)}</g><g id="mp-range">${mpRangeSvg(t)}</g><g id="mp-points">${mpPointsSvg(t)}</g><g id="mp-cities">${mpCitiesSvg(t)}</g><g id="mp-troops">${mpTroopsSvg(t)}</g></svg>`;
  const zoom = `<div class="mp-zoom"><button class="btn sm" data-a="mapZoom" data-z="1.3" aria-label="Zoom in">${ico("plus")}</button><button class="btn sm" data-a="mapZoom" data-z="0.77" aria-label="Zoom out">−</button><button class="btn sm" data-a="mapZoom" data-z="0">Fit</button><button class="btn sm${mpTerr ? " on" : ""}" data-a="mapTerr" aria-pressed="${mpTerr}">Terrain</button></div>${chair && mpHbOpen ? `<div class="mp-hb-pop">${mpHideBar(t)}</div>` : ""}`;
  const pk = chair ? mpPickLive().size : 0, pickBar = pk ? `<div class="mp-pickbar" role="status"><b>${plural(pk, "unit")} selected</b><span>Click the map to put ${pk > 1 ? "them" : "it"} down</span><button class="btn sm" data-a="mapPickClear">Clear</button></div>` : "";
  const legend = `<div class="mp-key"><span><i class="k-line"></i>Battle line</span><span><i class="k-trench"></i>Trench</span><span><i class="k-riv"></i>River</span><span><i class="k-for"></i>Forest</span><span><i class="k-el"></i>Low to high ground</span><span><i class="k-pt weak"></i>Weak point (+2 damage)</span><span><i class="k-pt fort"></i>Fortified point (-5 damage)</span><span><i class="k-dot"></i>Key city</span><span><i class="k-dot me"></i>${esc(chair ? sideLbl("me") : t === "t2" ? "Allied" : "France")}</span><span><i class="k-dot foe"></i>${esc(chair ? sideLbl("foe") : t === "t2" ? "Central" : "England")}</span><span>Zoom in for more cities</span></div>`;
  setTimeout(() => mpLabels(document.querySelector(".mapsvg")), 0);
  const col = c => `<aside class="mp-tl mp-${c}" aria-label="${c === "L" ? "Forces" : "Selected troop"}"><div class="mp-tl-in">${c === "L" ? mpForcesCol(t) : mpCardCol()}</div></aside>`;
  return head + `<div class="mp-wrap">${chair ? mpChairBar(t) : mpViewBar(t)}<div class="mp-main">${col("L")}<div class="mp-board"><div class="mp-stage"><div class="mp-view">${zoom}${pickBar}${svg}</div></div>${legend}</div>${col("R")}</div><div class="mp-foot">${mpTerrCard()}</div></div>`;
}

/* show / hide troops on the map, per side and per cabinet: this screen only, nothing is saved */
function mpHideBar(t) {
  const h = mpHide[t], all = mpTroops(), cabs = CABS(t);
  const chip = (act, attr, key, label, dot, n) => { const off = h.has(key); return `<button class="hb-chip${off ? " off" : ""}" data-a="${act}" ${attr} aria-pressed="${!off}" title="${off ? "Show" : "Hide"} ${esc(label)} troops (your screen only)">${dot ? `<i style="background:${esc(dot)}"></i>` : ""}<b>${esc(label)}</b><small>${n}</small></button>`; };
  const sides = ["me", "foe", "ne"].map(sd => chip("mapHideSide", `data-s="${sd}"`, "side:" + sd, sideLbl(sd).replace(/ Powers$/, ""), sd === "me" ? "var(--me)" : sd === "foe" ? "var(--foe)" : "#8a91a0", all.filter(x => x.side === sd).length)).join("");
  const cn = id => all.filter(x => mpCabKey(x) === id).length, none = cn("_");
  const cabChips = cabs.map(c => chip("mapHideCab", `data-c="${c.id}"`, "cab:" + c.id, c.name, c.color, cn(c.id))).join("") + (none ? chip("mapHideCab", 'data-c="_"', "cab:_", "No country", "#6b7380", none) : "");
  const anyOff = h.size > 0;
  return `<div class="mp-hb" role="group" aria-label="Show or hide troops on the map"><span class="mp-hb-k">Show</span><div class="mp-hb-row">${sides}${cabs.length ? `<i class="mp-sep"></i>${cabChips}` : ""}</div><div class="mp-hb-act">${cabs.length ? `<button class="btn sm plain" data-a="mapHideAll" data-v="hide">Hide all</button>` : ""}<button class="btn sm plain" data-a="mapHideAll" data-v="show" ${anyOff ? "" : "disabled"}>Show all</button></div></div>`;
}
const mpTerrCard = () => `<section class="panel mp-card"><div class="panel-h" style="margin:0"><div><h3>Terrain</h3><p>What the ground does to a force</p></div><button class="btn sm" data-a="mapTerrCard" aria-expanded="${mpTerrOpen}">${mpTerrOpen ? "Hide" : "Show"}</button></div>${mpTerrOpen ? `<div style="margin-top:10px">${((window.SENTINEL_TERRAIN || {}).effects || []).map(e => `<div class="tr-fx"><i class="k-${e.k}"></i><div><b>${esc(e.n)}</b><span>${esc(e.move)}</span><span>${esc(e.fight)}</span></div></div>`).join("")}<p class="muted" style="margin-top:10px">Suggested values: put them in the Situational multiplier of the Combat Calculator. The chairs rule on any crossing.</p></div>` : ""}</section>`;
const mpChips = (L, act, sel, tr) => L.map(l => `<button class="mp-chip${l.id === sel ? " on" : ""}${isTrench(l) ? ` tr-${l.side}` : ""}" data-a="${act}" data-id="${esc(l.id)}"><i class="mp-sw"></i><b>${esc(l.name)}</b><span>${tr ? TR_TIER[l.tier] : plural(l.pts.length, "point")}</span></button>`).join("");
function mpViewBar(t) {
  const L = LN[t].filter(l => !isTrench(l));
  return `<section class="panel mp-card mp-bar"><div class="mp-bar-lines"><span class="mp-bar-k">Battle lines</span><div class="mp-chips">${mpChips(L, "mapFocus") || '<span class="muted">The chairs have not drawn a battle line yet.</span>'}</div></div></section>`;
}
/* one context strip under the tools: what this tool does on the left, its controls on the right */
const mpCtx = (main, ctl) => `<div class="mp-ctx"><div class="mp-ctx-main">${main}</div>${ctl ? `<div class="mp-ctx-ctl">${ctl}</div>` : ""}</div>`;
const mpHint = (title, text) => `${title ? `<b>${title}</b>` : ""}<span>${text}</span>`;
const mpLbl = t => `<span class="mp-lbl">${t}</span>`;
/* which troops appear on the map (this screen only): one toggle per side, always in view, and the countries behind a button */
function mpVisRow(t) {
  const h = mpHide[t], all = mpTroops(), nm = sd => sideLbl(sd).replace(/ Powers$/, ""), cabsOff = CABS(t).filter(c => h.has("cab:" + c.id)).length;
  const tog = sd => { const off = h.has("side:" + sd), n = all.filter(x => x.side === sd).length; return `<button class="vis-t vis-${sd}${off ? " off" : ""}" data-a="mapHideSide" data-s="${sd}" aria-pressed="${!off}" title="${off ? "Show" : "Hide"} every ${esc(sideLbl(sd))} troop on the map">${ico(off ? "eyeoff" : "eye")}<b>${esc(nm(sd))}</b><small>${off ? "hidden" : n + " on map"}</small></button>`; };
  return `<div class="mp-vis" role="group" aria-label="Troops visible on the map"><span class="mp-vis-k">Visible on the map</span>${["me", "foe", "ne"].map(tog).join("")}${CABS(t).length ? `<button class="btn sm${mpHbOpen ? " on" : ""}" data-a="mapHb" aria-expanded="${mpHbOpen}">Countries${cabsOff ? ` <em class="mp-hn">${cabsOff} off</em>` : ""}</button>` : ""}<button class="btn sm plain" data-a="mapHideAll" data-v="show" ${h.size ? "" : "disabled"}>Show everything</button><span class="mp-vis-n">Your screen only</span></div>`;
}
function mpChairBar(t) {
  const L = LN[t], sel = L.find(l => l.id === mpSel);
  const tools = seg("mapTool", [["edit", "Reshape"], ["draw", "Draw a line"], ["trench", "Trenches"], ["city", "Cities"], ["pts", "Weak / fortified"]], mpTool, "t");
  const sides = [["me", sideLbl("me")], ["foe", sideLbl("foe")]], tiers = TR_TIERS.map(k => [k, TR_TIER[k]]);
  let ctx = "";
  if (mpTool === "trench") {
    const have = L.filter(l => isTrench(l) && l.side === mpTrNew.side);
    ctx = mpCtx(mpHint(`Digging: ${esc(trName(mpTrNew.side, mpTrNew.tier))} <em class="mp-n">${plural(mpDraft.length, "point")}</em>`, `Pick the side and the kind, then click the map from one end of the trench to the other. ${esc(sideLbl(mpTrNew.side))} has ${have.length ? TR_TIERS.map(k => `${have.filter(l => l.tier === k).length} ${TR_TIER[k].toLowerCase()}`).join(", ") : "no trenches yet"}.`),
      `${seg("mapTrNewSide", sides, mpTrNew.side, "s")}${seg("mapTrNewTier", tiers, mpTrNew.tier, "k")}<i class="mp-sep"></i><button class="btn sm" data-a="mapUndoPt" ${mpDraft.length ? "" : "disabled"}>Undo point</button><button class="btn sm" data-a="mapCancelDraw">Cancel</button><button class="btn sm primary" data-a="mapFinish" ${mpDraft.length < 2 ? "disabled" : ""}>Finish trench</button>`);
  } else if (mpTool === "draw") {
    ctx = mpCtx(mpHint(`Drawing a new line <em class="mp-n">${plural(mpDraft.length, "point")}</em>`, "Click the map from one end of the line to the other."),
      `<button class="btn sm" data-a="mapUndoPt" ${mpDraft.length ? "" : "disabled"}>Undo point</button><button class="btn sm" data-a="mapCancelDraw">Cancel</button><button class="btn sm primary" data-a="mapFinish" ${mpDraft.length < 2 ? "disabled" : ""}>Finish line</button>`);
  } else if (mpTool === "pts") {
    const q = (PTS[t] || []).find(x => x.id === mpPt), n = (PTS[t] || []).length;
    const main = q ? mpHint(`${esc(q.name || PT_ICON[q.kind])} <em class="mp-n">${q.name ? PT_ICON[q.kind] + " · " : ""}${q.r} km radius</em>`, "Drag it to move it, drag the ring to resize.") : mpHint(`Weak / fortified points <em class="mp-n">${n} on this map</em>`, "Pick a kind, then click the map. Drag a point to move it.");
    ctx = mpCtx(main, (q ? `<button class="btn sm" data-a="mapPtR" data-d="-10">Smaller</button><button class="btn sm" data-a="mapPtR" data-d="10">Larger</button><button class="btn sm" data-a="mapPtKind">Make ${q.kind === "weak" ? "fortified" : "weak"}</button><button class="btn sm" data-a="mapPtName">Rename</button><button class="btn sm danger" data-a="mapPtDel">Remove</button><i class="mp-sep"></i>` : "") +
      seg("mapPtNew", [["weak", "Place weak"], ["fort", "Place fortified"]], mpPtNew || "", "k"));
  } else if (mpTool === "city") {
    const cur = mpCity && ((LN.citySides && LN.citySides[t]) || {})[mpCity];
    ctx = mpCity ? mpCtx(mpHint(esc(mpCity), cur ? "Given to a side by the chairs." : "Default side. Who holds it?"), seg("mapCitySide", [["me", sideLbl("me")], ["foe", sideLbl("foe")], ["n", "Neutral"]], cur || "", "s") + `<button class="btn sm" data-a="mapCityDef" ${cur ? "" : "disabled"}>Back to default</button>`)
      : mpCtx(mpHint("", "Click a city on the map, then give it to a side."));
  } else if (sel && isTrench(sel)) {
    ctx = mpCtx(mpHint(`${esc(sel.name)} <em class="mp-n">${esc(sideLbl(sel.side))} · ${TR_TIER[sel.tier]} · ${plural(sel.pts.length, "point")}</em>`, mpVx != null ? "Point chosen. Remove it, or double-click it." : "Drag a round point to move it, a small one to bend the trench."),
      `${seg("mapTrSide", sides, sel.side, "s")}${seg("mapTrTier", tiers, sel.tier, "k")}<i class="mp-sep"></i><button class="btn sm" data-a="mapRename">Rename</button><button class="btn sm" data-a="mapSimplify">Fewer points</button><button class="btn sm" data-a="mapDelPt" ${mpVx != null && sel.pts.length > 2 ? "" : "disabled"}>Remove point</button><button class="btn sm danger" data-a="mapDelLine">Delete trench</button>`);
  } else if (sel) {
    const zone = seg("mapZone", mpClosed(mpGeo(t), sel) ? [["", "Off"], ["w", "Blue inside"], ["e", "Red inside"]] : [["", "Off"], ["w", "Blue west"], ["e", "Blue east"]], sel.zone || "", "z");
    ctx = mpCtx(mpHint(`${esc(sel.name)} <em class="mp-n">${plural(sel.pts.length, "point")}</em>`, mpVx != null ? "Point chosen. Remove it, or double-click it." : "Drag a round point to move it, a small one to bend the line."),
      `${mpLbl("Zone")}${zone}<i class="mp-sep"></i><button class="btn sm" data-a="mapRename">Rename</button><button class="btn sm" data-a="mapSimplify">Fewer points</button><button class="btn sm" data-a="mapDelPt" ${mpVx != null && sel.pts.length > 2 ? "" : "disabled"}>Remove point</button><button class="btn sm danger" data-a="mapDelLine">Delete line</button>`);
  } else ctx = "";
  const lines = L.filter(l => !isTrench(l)), trs = L.filter(isTrench).sort((a, b) => (a.side === b.side ? 0 : a.side === "me" ? -1 : 1) || TR_TIERS.indexOf(a.tier) - TR_TIERS.indexOf(b.tier));
  const chips = mpChips(lines, "mapLine", mpDrawing() ? null : mpSel), trChips = mpChips(trs, "mapLine", mpDrawing() ? null : mpSel, true);
  const lists = (lines.length ? `<span class="mp-bar-k">Lines</span>${chips}` : "") + (trs.length ? `<span class="mp-bar-k">Trenches</span>${trChips}` : "");
  return `<section class="panel mp-card mp-bar">${mpTurnBar(t)}${mpVisRow(t)}<div class="mp-bar-top">${tools}<div class="mp-chips mp-lists">${lists}</div><button class="btn sm plain" data-a="mapReset" title="Put the default battle lines back">Restore defaults</button></div>${ctx}</section>`;
}

const MAPA = {
  mapFull: () => { const off = document.body.classList.toggle("side-off"); document.body.classList.remove("nav-open"); try { localStorage.setItem("sentinel-side2", off ? "off" : "on"); } catch (e) {} if (typeof syncMenu === "function") syncMenu(); render(); setTimeout(() => mpLabels(document.querySelector(".mapsvg")), 260); },
  mapHb: () => { mpHbOpen = !mpHbOpen; render(); },
  mapTurn: el => mpTurnSend(el.dataset.op),
  mapTurnReset: el => arm(el, () => mpTurnSend("reset")),
  mapTool: el => { mpTool = el.dataset.t; mpPtNew = null; mpPt = null; mpDraft = []; mpVx = null; mpCity = null; mpPick.clear(); render(); },
  mapZoom: el => {
    const z = Number(el.dataset.z), g = mpGeo(S.topic); if (!z) { MPV = mpFit(g); render(); return; }
    const cx = MPV.x + MPV.w / 2, cy = MPV.y + MPV.h / 2; MPV.w /= z; MPV.h /= z; MPV.x = cx - MPV.w / 2; MPV.y = cy - MPV.h / 2; mpClampView(); render();
  },
  mapBg: (el, e) => {
    if (ROLE === "delegate") return;
    if (mpPick.size) { const svg = el.ownerSVGElement, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()), ll = mpLL(mpGeo(S.topic), q.x, q.y); mpTroopPlaceAt(ll[0], ll[1]); return; }
    if (mpTool === "pts") {
      if (!mpPtNew) { if (mpPt) { mpPt = null; render(); } return; }
      const svg = el.ownerSVGElement, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()), ll = mpLL(mpGeo(S.topic), q.x, q.y), L = PTS[S.topic] = PTS[S.topic] || [];
      if (L.length >= 60) { toast("Sixty points is the most a map can hold"); return; }
      const id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); L.push({ id, kind: mpPtNew, lat: ll[0], lon: ll[1], r: 50, name: "" }); mpPt = id; mpPtNew = null; render(); mpPtSave(); return;
    }
    if (mpTS && !mpDrawing()) { mpTS = null; mpRG = null; render(); return; }
    if (mpDrawing()) {
      const svg = el.ownerSVGElement, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      if (mpDraft.length >= 120) { toast("That is the longest a line can be"); return; }
      mpDraft.push(mpLL(mpGeo(S.topic), q.x, q.y)); mpDraftUi(); return;
    }
    if (mpSel) { mpSel = null; mpVx = null; render(); }
  },
  mapLine: el => { if (mpDrawing() && ROLE !== "delegate") return; mpSel = el.dataset.id; mpVx = null; if (ROLE === "delegate") { MAPA.mapFocus(el); return; } render(); },
  mapVx: el => { mpVx = Number(el.dataset.i); render(); },
  mapFocus: el => {
    const l = LN[S.topic].find(x => x.id === el.dataset.id); if (!l) return; const g = mpGeo(S.topic), ps = l.pts.map(p => mpXY(g, p[0], p[1]));
    const x0 = Math.min(...ps.map(p => p[0])), x1 = Math.max(...ps.map(p => p[0])), y0 = Math.min(...ps.map(p => p[1])), y1 = Math.max(...ps.map(p => p[1])), f = mpFit(g);
    MPV.w = Math.max(f.w / 4, (x1 - x0) * 1.5, (y1 - y0) * 1.5 * 16 / 9); MPV.h = MPV.w * 9 / 16; MPV.x = (x0 + x1) / 2 - MPV.w / 2; MPV.y = (y0 + y1) / 2 - MPV.h / 2; mpClampView(); render();
  },
  mapFinish: () => {
    if (mpDraft.length < 2) return;
    if (LN[S.topic].length >= 40) { toast("Forty lines and trenches is the most a map can hold"); return; }
    if (mpTool === "trench") {   /* a trench is named after its side and kind; rename it afterwards if you like */
      const id = "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), { side, tier } = mpTrNew;
      LN[S.topic].push({ id, kind: "trench", side, tier, zone: "", name: trName(side, tier), pts: mpDraft.slice() }); mpDraft = []; mpVx = null;
      toast(`${trName(side, tier)} dug`); render(); mpSave(); return;
    }
    askText("Name this line", "Name", mpName(), nm => {
      if (mpDraft.length < 2) return; const id = "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      LN[S.topic].push({ id, zone: "w", name: nm.slice(0, 40), pts: mpDraft.slice() }); mpSel = id; mpDraft = []; mpTool = "edit"; mpVx = null; render(); mpSave();
    });
  },
  mapTrNewSide: el => { mpTrNew = { ...mpTrNew, side: el.dataset.s }; render(); },
  mapTrNewTier: el => { mpTrNew = { ...mpTrNew, tier: el.dataset.k }; render(); },
  mapTrSide: el => { const l = LN[S.topic].find(x => x.id === mpSel); if (!isTrench(l) || l.side === el.dataset.s) return; const auto = l.name === trName(l.side, l.tier); l.side = el.dataset.s; if (auto) l.name = trName(l.side, l.tier); render(); mpSave(); },
  mapTrTier: el => { const l = LN[S.topic].find(x => x.id === mpSel); if (!isTrench(l) || l.tier === el.dataset.k) return; const auto = l.name === trName(l.side, l.tier); l.tier = el.dataset.k; if (auto) l.name = trName(l.side, l.tier); render(); mpSave(); },
  mapYes: () => { const cb = UI.askCb; closeModal(); if (cb) cb(); },
  mapSimplify: () => {   /* drop the points that barely bend the line (Douglas-Peucker), the ends stay */
    const l = LN[S.topic].find(x => x.id === mpSel); if (!l || l.pts.length < 4) return; const g = mpGeo(S.topic), xy = l.pts.map(p => mpXY(g, p[0], p[1])), keep = new Array(xy.length).fill(false), tol = 5;
    const dp = (a, b) => { let m = 0, k = -1; const A = xy[a], B = xy[b], vx = B[0] - A[0], vy = B[1] - A[1], L = Math.hypot(vx, vy) || 1; for (let i = a + 1; i < b; i++) { const d = Math.abs((xy[i][0] - A[0]) * vy - (xy[i][1] - A[1]) * vx) / L; if (d > m) { m = d; k = i; } } if (m > tol && k > 0) { keep[k] = true; dp(a, k); dp(k, b); } };
    keep[0] = keep[xy.length - 1] = true; dp(0, xy.length - 1); const n0 = l.pts.length; l.pts = l.pts.filter((p, i) => keep[i]); mpVx = null; render(); mpSave(); toast(n0 + " points down to " + l.pts.length);
  },
  mapPtNew: el => { mpPtNew = mpPtNew === el.dataset.k ? null : el.dataset.k; mpPt = null; render(); },
  mapPt: el => { if (mpTool !== "pts" || ROLE === "delegate") return; mpPt = el.dataset.id; mpPtNew = null; render(); },
  mapPtR: el => { const q = (PTS[S.topic] || []).find(x => x.id === mpPt); if (!q) return; q.r = Math.max(5, Math.min(1000, q.r + Number(el.dataset.d))); render(); mpPtSave(); },
  mapPtKind: () => { const q = (PTS[S.topic] || []).find(x => x.id === mpPt); if (!q) return; q.kind = q.kind === "weak" ? "fort" : "weak"; render(); mpPtSave(); },
  mapPtName: () => { const q = (PTS[S.topic] || []).find(x => x.id === mpPt); if (!q) return; askText("Name this point", "Name", q.name || "", nm => { q.name = nm.slice(0, 40); render(); mpPtSave(); }); },
  mapPtDel: () => { PTS[S.topic] = (PTS[S.topic] || []).filter(x => x.id !== mpPt); mpPt = null; render(); mpPtSave(); },
  mapZone: el => { const l = LN[S.topic].find(x => x.id === mpSel); if (!l) return; l.zone = el.dataset.z; render(); mpSave(); },
  mapTerrCard: () => { mpTerrOpen = !mpTerrOpen; render(); },
  mapTerr: () => { mpTerr = !mpTerr; render(); },
  mapCity: el => { if (ROLE === "delegate" || mpTool !== "city") return; mpCity = el.dataset.n; render(); },
  mapCitySide: el => mpCitySet(el.dataset.s),
  mapCityDef: () => mpCitySet("default"),
  mapUndoPt: () => { mpDraft.pop(); mpDraftUi(); },
  mapCancelDraw: () => { mpDraft = []; mpTool = "edit"; render(); },
  mapRename: () => { const l = LN[S.topic].find(x => x.id === mpSel); if (!l) return; askText("Rename the line", "Name", l.name, nm => { l.name = nm.slice(0, 40); render(); mpSave(); }); },
  mapDelPt: () => { const l = LN[S.topic].find(x => x.id === mpSel); if (!l || mpVx == null || l.pts.length <= 2) return; l.pts.splice(mpVx, 1); mpVx = null; render(); mpSave(); },
  mapDelLine: () => { const l = LN[S.topic].find(x => x.id === mpSel); if (!l) return; mpAsk("Delete the line?", "“" + l.name + "” goes for everyone.", "Delete", () => { LN[S.topic] = LN[S.topic].filter(x => x.id !== l.id); mpSel = null; mpVx = null; render(); mpSave(); }); },
  mapReset: () => { mpAsk("Restore the starting lines?", "Lines you drew on this map are lost.", "Restore", () => SentinelAuth.api("POST", "/api/lines", { topic: S.topic, reset: true }).then(r => { if (!r.ok) throw new Error("reset"); mpSel = null; mpVx = null; mpLoadData(); }).catch(() => toast("Could not reset the lines"))); }
};
const MAPC = {}, MAPI = {};

function mpClampView() {
  const g = mpGeo(S.topic), maxW = Math.max(g.W, g.H * 16 / 9) * 1.05; MPV.w = Math.min(maxW, Math.max(g.W / 40, MPV.w)); MPV.h = MPV.w * 9 / 16;
  const ax = (p, len, size) => { const lo = -size * 0.05, hi = size * 1.05; return len >= hi - lo ? (lo + hi - len) / 2 : Math.min(hi - len, Math.max(lo, p)); };
  MPV.x = ax(MPV.x, MPV.w, g.W); MPV.y = ax(MPV.y, MPV.h, g.H);
}
const mpSetView = svg => { svg.setAttribute("viewBox", MPV.x + " " + MPV.y + " " + MPV.w + " " + MPV.h); mpZoomAttr(svg); };
/* drag a point, drag the map to pan, wheel to zoom: the viewBox or the lines layer change, the page is not redrawn */
(function () {
  let pan = null;
  const toSvg = (svg, e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  document.addEventListener("pointerdown", e => {
    const s = e.target.closest && e.target.closest(".mapsvg"); if (!s || e.button || !MPV) return;
    mpPressed = Date.now(); mpFly++;   /* the page is not redrawn under a press (app.js dragging()), or the click would land on a marker that has just been replaced */
    const h = e.target.closest(".vh, .vm");
    if (h && ROLE !== "delegate" && mpTool === "edit" && mpSel) {
      const l = LN[S.topic].find(x => x.id === mpSel); if (!l) return;
      let i = Number(h.dataset.i);
      if (h.classList.contains("vm")) { const g = mpGeo(S.topic), a = mpXY(g, l.pts[i][0], l.pts[i][1]), b = mpXY(g, l.pts[i + 1][0], l.pts[i + 1][1]); l.pts.splice(i + 1, 0, mpLL(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); i += 1; mpVx = i; mpRedrawLines(); }
      mpDrag = { id: l.id, i, x: e.clientX, y: e.clientY, moved: false, s, added: h.classList.contains("vm") }; e.preventDefault(); return;
    }
    const pd = e.target.closest(".pt-i, .pt-rh");   /* a weak / fortified point: drag it to move it, drag the ring handle to resize it */
    if (pd && ROLE !== "delegate" && mpTool === "pts" && !mpPtNew) {
      const q = (PTS[S.topic] || []).find(x => x.id === (pd.dataset.id)); if (!q) return;
      mpPD = { id: q.id, mode: pd.classList.contains("pt-rh") ? "r" : "m", x: e.clientX, y: e.clientY, moved: false, s }; e.preventDefault(); return;
    }
    if (ROLE !== "delegate" && e.target.closest(".trp")) return;   /* a troop is dragged on its own, the map stays put */
    const ph = e.target.closest(".ln-hit");   /* take hold of a line anywhere: one new point appears under your finger and goes where you drag it */
    if (ph && ROLE !== "delegate" && mpTool === "edit") {
      const l = LN[S.topic].find(x => x.id === ph.dataset.id); if (!l) return; const g = mpGeo(S.topic), P = toSvg(s, e), xy = l.pts.map(p => mpXY(g, p[0], p[1]));
      let best = 0, bd = Infinity, bq = null;
      for (let i = 0; i < xy.length - 1; i++) {
        const A = xy[i], B = xy[i + 1], vx = B[0] - A[0], vy = B[1] - A[1], L2 = vx * vx + vy * vy || 1, u = Math.max(0, Math.min(1, ((P.x - A[0]) * vx + (P.y - A[1]) * vy) / L2)), q = [A[0] + vx * u, A[1] + vy * u], dd = Math.hypot(P.x - q[0], P.y - q[1]);
        if (dd < bd) { bd = dd; best = i; bq = q; }
      }
      l.pts.splice(best + 1, 0, mpLL(g, bq[0], bq[1])); mpSel = l.id; mpVx = best + 1;
      mpDrag = { id: l.id, i: best + 1, x: e.clientX, y: e.clientY, moved: false, s, added: true }; mpRedrawLines(); e.preventDefault(); return;
    }
    pan = { x: e.clientX, y: e.clientY, vx: MPV.x, vy: MPV.y, s, moved: false };
  });
  document.addEventListener("pointermove", e => {
    if ((mpDrag || mpPD || pan) && e.pointerType === "mouse" && e.buttons === 0) { end(); return; }   /* the button was let go somewhere we were not told about: stop dragging instead of following the mouse around */
    if (mpPD) {
      if (!mpPD.moved && Math.hypot(e.clientX - mpPD.x, e.clientY - mpPD.y) < 3) return; mpPD.moved = true; mpDragged = true;
      const q = (PTS[S.topic] || []).find(x => x.id === mpPD.id); if (!q) return; const g = mpGeo(S.topic), P = toSvg(mpPD.s, e);
      if (mpPD.mode === "m") { const ll = mpLL(g, P.x, P.y); q.lat = ll[0]; q.lon = ll[1]; }
      else { const c = mpXY(g, q.lat, q.lon); q.r = Math.max(5, Math.min(1000, Math.round(Math.hypot(P.x - c[0], P.y - c[1]) / g.sc * PT_KM))); }
      mpPt = q.id; mpPointsRedraw(); return;
    }
    if (mpDrag) {
      if (!mpDrag.moved && Math.hypot(e.clientX - mpDrag.x, e.clientY - mpDrag.y) < 3) return; mpDrag.moved = true; mpDragged = true;
      const l = LN[S.topic].find(x => x.id === mpDrag.id); if (!l) return; const q = toSvg(mpDrag.s, e);
      if (mpDrag.push) {
        const { g, P, xy, R } = mpDrag.push, dx = q.x - P.x, dy = q.y - P.y, n = xy.length;
        l.pts = xy.map((p, i) => { if (i === 0 || i === n - 1) return l.pts[i]; const u = Math.max(0, 1 - Math.hypot(p[0] - P.x, p[1] - P.y) / R), w = u * u * (3 - 2 * u); return w ? mpLL(g, p[0] + dx * w, p[1] + dy * w) : l.pts[i]; });
        mpRedrawLines(); return;
      }
      l.pts[mpDrag.i] = mpLL(mpGeo(S.topic), q.x, q.y); mpRedrawLines(); return;
    }
    if (!pan || mpTDrag) return; const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < mpSlop(e)) return; pan.moved = true; mpDragged = true;
    const k = MPV.w / pan.s.getBoundingClientRect().width; MPV.x = pan.vx - dx * k; MPV.y = pan.vy - dy * k; mpClampView(); mpSetView(pan.s);
  });
  const end = () => { const pd = mpPD; mpPD = null; if (pd && pd.moved) { mpPt = pd.id; mpPtNew = null; mpDragged = true; render(); mpPtSave(); } const d = mpDrag; mpDrag = null; pan = null; mpPressed = 0; if (d && (d.moved || d.added)) { if (d.added) mpDragged = true; render(); mpSave(); } setTimeout(() => { mpDragged = false; }, 0); };
  window.addEventListener("resize", () => mpLabelsSoon(document.querySelector(".mapsvg")));
  document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end); window.addEventListener("blur", end);
  document.addEventListener("click", e => { if (mpDragged) { e.stopPropagation(); e.preventDefault(); mpDragged = false; } }, true);
  document.addEventListener("dblclick", e => { const h = e.target.closest && e.target.closest(".vh[data-a=mapVx]"); if (h && ROLE !== "delegate") { mpVx = Number(h.dataset.i); MAPA.mapDelPt(); } });
  document.addEventListener("wheel", e => {
    const s = e.target.closest && e.target.closest(".mapsvg"); if (!s || !MPV) return; e.preventDefault(); mpFly++;
    const b = s.getBoundingClientRect(), z = e.deltaY < 0 ? 1.15 : 0.87, px = MPV.x + (e.clientX - b.left) / b.width * MPV.w, py = MPV.y + (e.clientY - b.top) / b.height * MPV.h;
    MPV.w /= z; MPV.h /= z; MPV.x = px - (e.clientX - b.left) / b.width * MPV.w; MPV.y = py - (e.clientY - b.top) / b.height * MPV.h; mpClampView(); mpSetView(s);
  }, { passive: false });
  setInterval(() => { if (typeof UI !== "undefined" && UI.page === "map" && !document.hidden && !mpDrag && !mpPD && !mpDraft.length && LN) mpLoadData(true); }, 15000);
})();
