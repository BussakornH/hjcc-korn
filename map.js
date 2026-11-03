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
let mpTerrOpen = false, mpDEM = {}, MPREL = {}, mpTD = null, mpTerr = true, mpCity = null, MPLAND = null, MPB = {}, LN = null, MPBASE = {}, MPV = null, MPT = null, mpTool = "edit", mpSel = null, mpVx = null, mpDraft = [], mpLoad = 0, mpDragged = false, mpDrag = null;

/* every map is 1000 units wide, so text and points look the same size on both topics; sc is units per degree of latitude */
const mpGeo = t => { const c = MPCFG[t], k = Math.cos(((c.lat[0] + c.lat[1]) / 2) * Math.PI / 180), sc = 1000 / ((c.lon[1] - c.lon[0]) * k); return { c, k, sc, lon0: c.lon[0], top: c.lat[1], W: 1000, H: (c.lat[1] - c.lat[0]) * sc }; };
const mpXY = (g, lat, lon) => [(lon - g.lon0) * g.k * g.sc, (g.top - lat) * g.sc];
const mpLL = (g, x, y) => [Math.round((g.top - y / g.sc) * 1000) / 1000, Math.round((g.lon0 + x / (g.k * g.sc)) * 1000) / 1000];
const mpPath = (g, pts) => "M" + pts.map(p => mpXY(g, p[0], p[1]).map(v => v.toFixed(0)).join(" ")).join("L");
/* the map window is always 16:9 (a screen): it shows a band of the theatre across its full width, centred; zoom out to see all of it */
const mpFit = g => { const h = g.W * 9 / 16; return { x: 0, y: (g.H - h) / 2, w: g.W, h }; };

function mpLoadData(quiet) {
  const t = S.topic, c = MPCFG[t];
  const need = MPLAND ? Promise.resolve() : fetch("land.json").then(r => r.json()).then(j => { MPLAND = j.rings; }, () => { MPLAND = []; });
  const bor = MPB[t] ? Promise.resolve() : fetch(c.url).then(r => r.json()).then(j => { MPB[t] = j; }, () => { MPB[t] = { f: [] }; });
  const terr = mpTD ? Promise.resolve() : fetch("terrain-data.json").then(r => r.json()).then(j => { mpTD = j; }, () => { mpTD = { rivers: [], ranges: [] }; });
  const dem = MPREL[t] ? Promise.resolve() : (mpDEM[t] ? Promise.resolve() : mpDemLoad(t)).then(() => mpRelief(t)).then(u => { MPREL[t] = u; }, () => { MPREL[t] = "none"; });
  const trp = SentinelAuth.api("GET", "/api/troops").then(r => r.ok ? r.json() : null).then(j => { if (j && !mpTPend && !mpTDrag) { mpTrAdopt(j); TRMINE = j.mine || {}; mpTroopSync(); } }, () => {});
  const lines = SentinelAuth.api("GET", "/api/lines").then(r => r.ok ? r.json() : Promise.reject());
  return Promise.all([need, bor, lines, terr, dem, trp]).then(a => {
    LN = a[2]; mpLoad = 2;
    if (mpSel && !LN[t].some(l => l.id === mpSel)) { mpSel = null; mpVx = null; }
    if (UI.page === "map" && !(quiet && (mpDrag || mpDraft.length || document.querySelector("#page :focus")))) render();
  }, () => { mpLoad = -1; if (UI.page === "map") render(); });
}
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

/* the battle lines, drawn on top; redrawn alone while you drag a point */
/* a line that comes back to where it began is an area (a landing zone): its inside takes the colour */
const mpClosed = (g, l) => { if (l.pts.length < 4) return false; const a = mpXY(g, l.pts[0][0], l.pts[0][1]), b = mpXY(g, l.pts[l.pts.length - 1][0], l.pts[l.pts.length - 1][1]); return Math.hypot(a[0] - b[0], a[1] - b[1]) < 40; };
function mpLinesSvg(t) {
  const g = mpGeo(t), edit = ROLE !== "delegate" && mpTool === "edit", hr = 8;
  let o = "";
  /* occupied ground: the line splits the map, and each side takes a colour (west/east for a front that runs north-south) */
  (LN[t] || []).forEach(l => {
    if (!l.zone) return;
    if (mpClosed(g, l)) { o += `<g clip-path="url(#mp-clip)" class="zn"><path class="${l.zone === "w" ? "zn-me" : "zn-foe"}" d="M${l.pts.map(p => mpXY(g, p[0], p[1]).map(v => v.toFixed(0)).join(" ")).join("L")}Z"/></g>`; return; }
    let q = l.pts.map(p => mpXY(g, p[0], p[1])); if (q[0][1] > q[q.length - 1][1]) q = q.reverse();
    const f = n => n.toFixed(0), body = q.map(p => f(p[0]) + " " + f(p[1])).join("L"), a = q[0], z = q[q.length - 1];
    const west = `M0 0L${f(a[0])} 0L${body}L${f(z[0])} ${f(g.H)}L0 ${f(g.H)}Z`, east = `M${f(g.W)} 0L${f(a[0])} 0L${body}L${f(z[0])} ${f(g.H)}L${f(g.W)} ${f(g.H)}Z`;
    o += `<g clip-path="url(#mp-clip)" class="zn"><path class="zn-me" d="${l.zone === "w" ? west : east}"/><path class="zn-foe" d="${l.zone === "w" ? east : west}"/></g>`;
  });
  (LN[t] || []).forEach(l => {
    const d = mpPath(g, l.pts), on = l.id === mpSel, pts = l.pts.map(p => mpXY(g, p[0], p[1]));
    o += `<g class="ln${on ? " on" : ""}"><path class="ln-h" d="${d}"/><path class="ln-l" d="${d}"/><path class="ln-hit" d="${d}" data-a="mapLine" data-id="${esc(l.id)}"/>`;
    [pts[0], pts[pts.length - 1]].forEach(p => { o += `<circle class="ln-e" cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="6"/>`; });
    const mid = pts[Math.floor(pts.length / 2)]; o += `<text class="ln-t" x="${mid[0].toFixed(0)}" y="${(mid[1] - 12).toFixed(0)}">${esc(l.name)}</text>`;
    if (on && edit) {
      pts.slice(0, -1).forEach((p, i) => { const q = pts[i + 1]; o += `<circle class="vm" data-i="${i}" cx="${((p[0] + q[0]) / 2).toFixed(0)}" cy="${((p[1] + q[1]) / 2).toFixed(0)}" r="${hr - 3}"/>`; });
      pts.forEach((p, i) => { o += `<circle class="vh${i === mpVx ? " on" : ""}" data-a="mapVx" data-i="${i}" cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="${hr}"/>`; });
    }
    o += "</g>";
  });
  if (mpDraft.length) {
    const pts = mpDraft.map(p => mpXY(g, p[0], p[1]));
    o += `<g class="ln draft"><path class="ln-l" d="${mpPath(g, mpDraft)}"/>${pts.map(p => `<circle class="vh" cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="${hr}"/>`).join("")}</g>`;
  }
  return o;
}
/* a yes/no box (the browser's own confirm is blocked in some windows) */
function mpAsk(title, text, label, cb) { UI.askCb = cb; openModal(`<h2>${esc(title)}</h2><p class="muted" style="margin-top:10px">${esc(text)}</p><div class="m-act"><button class="btn" data-a="modalClose">Cancel</button><button class="btn danger" data-a="mapYes">${esc(label)}</button></div>`); }
/* laying down or taking back a point only redraws the line and the counter, not the whole page (that flashed) */
function mpDraftUi() {
  mpRedrawLines(); const p = document.querySelector(".mp-act [data-a=mapFinish]"); if (!p) return;
  p.disabled = mpDraft.length < 2; document.querySelector(".mp-act [data-a=mapUndoPt]").disabled = !mpDraft.length; const b = p.closest(".mp-card").querySelector(".kv b"); if (b) b.textContent = mpDraft.length;
}
/* a redraw of the map page keeps the live map (borders, relief, terrain) and swaps only the layers that change: rebuilding the picture made the whole map flash */
function mpKeepMap(old, html) {
  const tpl = document.createElement("template"); tpl.innerHTML = html;
  const n = tpl.content.querySelector(".mapsvg"); if (!n || n.dataset.t !== old.dataset.t) return false;
  ["viewBox", "data-z", "data-tool", "data-terr"].forEach(a => old.setAttribute(a, n.getAttribute(a)));
  ["mp-lines", "mp-range", "mp-cities", "mp-troops"].forEach(id => { const a = old.querySelector("#" + id), b = n.querySelector("#" + id); if (a && b) a.innerHTML = b.innerHTML; });
  n.replaceWith(old); $("page").replaceChildren(tpl.content); mpLabels(old); return true;
}
const mpRedrawLines = () => { const e = document.getElementById("mp-lines"); if (e) e.innerHTML = mpLinesSvg(S.topic); };
const mpZoomAttr = svg => { if (svg && MPV) { svg.setAttribute("data-z", mpGeo(S.topic).W / MPV.w > 1.8 ? "1" : "0"); mpLabelsSoon(svg); } };
/* city names keep one size on screen at every zoom, and each takes the first free side (right, left, above, below); one that fits nowhere hides until you zoom in */
let mpLT = 0;
const mpLabelsSoon = svg => { cancelAnimationFrame(mpLT); mpLT = requestAnimationFrame(() => mpLabels(svg)); };
function mpLabels(svg) {
  if (!svg || !svg.isConnected || !MPV) return;
  const bw = svg.getBoundingClientRect().width; if (!bw) return; const k = MPV.w / bw; svg.style.setProperty("--k", k.toFixed(4)); svg.querySelectorAll("pattern").forEach(q => q.setAttribute("patternTransform", "scale(" + (k * 1.8).toFixed(4) + ")"));
  const placed = [], box = (x, y, w, h) => ({ x, y, w, h }), hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  [...svg.querySelectorAll(".cty")].sort((a, b) => (a.classList.contains("r0") ? 0 : 1) - (b.classList.contains("r0") ? 0 : 1)).forEach(g => {
    const t = g.querySelector("text"); if (!t) return; if (g.classList.contains("r1") && svg.getAttribute("data-z") !== "1") return;
    const px = (Number(g.dataset.x) - MPV.x) / k, py = (Number(g.dataset.y) - MPV.y) / k, w = t.textContent.length * 6.9 + 4, h = 15;
    placed.push(box(px - 5, py - 5, 10, 10));   /* the dot itself is also in the way */
    const tries = [["start", 9, 4, box(px + 7, py - h / 2, w, h)], ["end", -9, 4, box(px - 7 - w, py - h / 2, w, h)], ["middle", 0, -9, box(px - w / 2, py - 7 - h, w, h)], ["middle", 0, 17, box(px - w / 2, py + 7, w, h)]];
    const ok = tries.find(c => c[3].x > 0 && c[3].x + c[3].w < bw && !placed.some(p => hit(p, c[3])));
    if (!ok) { t.setAttribute("visibility", "hidden"); return; }
    t.removeAttribute("visibility"); t.setAttribute("text-anchor", ok[0]); t.setAttribute("x", (ok[1] * k).toFixed(2)); t.setAttribute("y", (ok[2] * k).toFixed(2)); placed.push(ok[3]);
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
  const head = `<div class="pg-head"><div><div class="eyebrow">${esc(topicLbl())}</div><h2 class="pg-h">Battle map</h2><p class="pg-p">${chair ? "Draw, move and remove the battle lines. Delegates see every change as soon as you save it." : "The theatre, its key cities and the battle lines. Chairs move the lines; this page updates by itself."}</p></div></div>`;
  const t = S.topic;
  if (!LN || !MPLAND || !MPB[t] || !mpTD || !MPREL[t]) { if (mpLoad !== 1 && mpLoad !== -1) { mpLoad = 1; mpLoadData(); } return head + `<section class="panel"><p class="muted">${mpLoad === -1 ? "Could not load the map." : "Loading the map…"}</p></section>`; }
  const g = mpGeo(t);
    if (MPT !== t) { MPT = t; MPV = mpFit(g); mpTS = null; mpPlace = null; mpSel = null; mpVx = null; mpDraft = []; mpTool = "edit"; }
  const v = MPV, svg = `<svg class="mapsvg" data-t="${t}" viewBox="${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}" data-z="${g.W / v.w > 1.8 ? 1 : 0}" data-tool="${chair ? mpTool : ""}" data-terr="${mpTerr ? 1 : 0}" role="img" aria-label="Battle map">${mpBase(t)}<g id="mp-lines">${mpLinesSvg(t)}</g><g id="mp-range">${mpRangeSvg(t)}</g><g id="mp-cities">${mpCitiesSvg(t)}</g><g id="mp-troops">${mpTroopsSvg(t)}</g></svg>`;
  const zoom = `<div class="mp-zoom"><button class="btn sm" data-a="mapZoom" data-z="1.3" aria-label="Zoom in">${ico("plus")}</button><button class="btn sm" data-a="mapZoom" data-z="0.77" aria-label="Zoom out">−</button><button class="btn sm" data-a="mapZoom" data-z="0">Fit</button><button class="btn sm${mpTerr ? " on" : ""}" data-a="mapTerr">Terrain</button></div>`;
  const legend = `<div class="mp-key"><span><i class="k-line"></i>Battle line</span><span><i class="k-riv"></i>River</span><span><i class="k-for"></i>Forest</span><span><i class="k-el"></i>Low to high ground</span><span><i class="k-dot"></i>Key city</span><span><i class="k-dot me"></i>${esc(chair ? sideLbl("me") : t === "t2" ? "Allied" : "France")}</span><span><i class="k-dot foe"></i>${esc(chair ? sideLbl("foe") : t === "t2" ? "Central" : "England")}</span><span>Zoom in for more cities</span></div>`;
  setTimeout(() => mpLabels(document.querySelector(".mapsvg")), 0);
  const col = c => `<aside class="mp-tl mp-${c}"><div class="mp-tl-in">${mpTroopCol(t, c)}</div></aside>`;
  return head + `<div class="mp-wrap">${chair ? mpChairBar(t) : mpViewBar(t)}<div class="mp-main">${col("L")}<div class="mp-board"><div class="mp-stage"><div class="mp-view">${zoom}${svg}</div></div>${legend}</div>${col("R")}</div><div class="mp-foot">${mpTerrCard()}</div></div>`;
}

const mpTerrCard = () => `<section class="panel mp-card"><div class="panel-h" style="margin:0"><div><h3>Terrain</h3><p>What the ground does to a force</p></div><button class="btn sm" data-a="mapTerrCard" aria-expanded="${mpTerrOpen}">${mpTerrOpen ? "Hide" : "Show"}</button></div>${mpTerrOpen ? `<div style="margin-top:10px">${((window.SENTINEL_TERRAIN || {}).effects || []).map(e => `<div class="tr-fx"><i class="k-${e.k}"></i><div><b>${esc(e.n)}</b><span>${esc(e.move)}</span><span>${esc(e.fight)}</span></div></div>`).join("")}<p class="muted" style="margin-top:10px">Suggested values: put them in the Situational multiplier of the Combat Calculator. The chairs rule on any crossing.</p></div>` : ""}</section>`;
function mpViewBar(t) {
  const L = LN[t];
  return `<section class="panel mp-card mp-bar"><div class="mp-bar-h"><h3>Battle lines</h3><span class="muted">${L.length ? plural(L.length, "line") + " in force" : "None drawn yet"}</span></div><div class="mp-chips">${L.map(l => `<button class="mp-u" data-a="mapFocus" data-id="${esc(l.id)}"><b>${esc(l.name)}</b><span>${plural(l.pts.length, "point")}</span></button>`).join("") || '<span class="muted">The chairs have not drawn a battle line yet.</span>'}</div></section>`;
}
function mpChairBar(t) {
  const L = LN[t], sel = L.find(l => l.id === mpSel);
  const tools = seg("mapTool", [["edit", "Reshape"], ["draw", "Draw a line"], ["city", "Cities"]], mpTool, "t");
  let body = "";
  if (mpTool === "draw") {
    body = `<span class="muted">Click the map to lay down the points of a new line, from one end to the other.</span><span class="kv"><span>Points</span><b>${mpDraft.length}</b></span>
      <span class="mp-act"><button class="btn sm primary" data-a="mapFinish" ${mpDraft.length < 2 ? "disabled" : ""}>Finish line</button><button class="btn sm" data-a="mapUndoPt" ${mpDraft.length ? "" : "disabled"}>Undo point</button><button class="btn sm" data-a="mapCancelDraw">Cancel</button></span>`;
  } else if (mpTool === "city") {
    const cur = mpCity && ((LN.citySides && LN.citySides[t]) || {})[mpCity];
    body = mpCity ? `<b>${esc(mpCity)}</b><span class="muted">${cur ? "Given to a side by the chairs" : "Default"}. Which side holds it?</span>${seg("mapCitySide", [["me", sideLbl("me")], ["foe", sideLbl("foe")], ["n", "Neutral"]], cur || "", "s")}<span class="mp-act"><button class="btn sm" data-a="mapCityDef" ${cur ? "" : "disabled"}>Back to default</button></span>` : `<span class="muted">Click any city on the map, then give it to a side.</span>`;
  } else if (sel) {
    body = `<b>${esc(sel.name)}</b><span class="muted">${plural(sel.pts.length, "point")}. Drag a round point to move it, a small one to bend the line. ${mpVx != null ? "Remove point, or double-click it, deletes the chosen point." : "Click a point to choose it."}</span>
      ${seg("mapZone", mpClosed(mpGeo(t), sel) ? [["", "Off"], ["w", "Blue inside"], ["e", "Red inside"]] : [["", "Off"], ["w", "Blue in the west"], ["e", "Blue in the east"]], sel.zone || "", "z")}<span class="mp-act"><button class="btn sm" data-a="mapRename">Rename</button><button class="btn sm" data-a="mapSimplify">Fewer points</button><button class="btn sm" data-a="mapDelPt" ${mpVx != null && sel.pts.length > 2 ? "" : "disabled"}>Remove point</button><button class="btn sm danger" data-a="mapDelLine">Delete line</button></span>`;
  } else body = `<span class="muted">Click a line to move or bend it, or draw a new one.</span>`;
  const list = L.length ? L.map(l => `<button class="mp-u${l.id === mpSel ? " on" : ""}" data-a="mapLine" data-id="${esc(l.id)}"><b>${esc(l.name)}</b><span>${plural(l.pts.length, "point")}</span></button>`).join("") : '<span class="muted">No battle lines yet.</span>';
  return `<section class="panel mp-card mp-bar"><div class="mp-bar-r">${tools}<div class="mp-bar-b">${body}</div></div><div class="mp-bar-r"><h3>Battle lines</h3><div class="mp-chips">${list}</div><button class="btn sm" data-a="mapReset">Restore defaults</button></div></section>`;
}

const MAPA = {
  mapTool: el => { mpTool = el.dataset.t; mpDraft = []; mpVx = null; mpCity = null; mpPlace = null; render(); },
  mapZoom: el => {
    const z = Number(el.dataset.z), g = mpGeo(S.topic); if (!z) { MPV = mpFit(g); render(); return; }
    const cx = MPV.x + MPV.w / 2, cy = MPV.y + MPV.h / 2; MPV.w /= z; MPV.h /= z; MPV.x = cx - MPV.w / 2; MPV.y = cy - MPV.h / 2; mpClampView(); render();
  },
  mapBg: (el, e) => {
    if (ROLE === "delegate") return;
    if (mpPlace) { const svg = el.ownerSVGElement, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()), ll = mpLL(mpGeo(S.topic), q.x, q.y); mpTroopPlaceAt(ll[0], ll[1]); return; }
    if (mpTS && mpTool !== "draw") { mpTS = null; mpRG = null; render(); return; }
    if (mpTool === "draw") {
      const svg = el.ownerSVGElement, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      if (mpDraft.length >= 120) { toast("That is the longest a line can be"); return; }
      mpDraft.push(mpLL(mpGeo(S.topic), q.x, q.y)); mpDraftUi(); return;
    }
    if (mpSel) { mpSel = null; mpVx = null; render(); }
  },
  mapLine: el => { if (mpTool === "draw" && ROLE !== "delegate") return; mpSel = el.dataset.id; mpVx = null; if (ROLE === "delegate") { MAPA.mapFocus(el); return; } render(); },
  mapVx: el => { mpVx = Number(el.dataset.i); render(); },
  mapFocus: el => {
    const l = LN[S.topic].find(x => x.id === el.dataset.id); if (!l) return; const g = mpGeo(S.topic), ps = l.pts.map(p => mpXY(g, p[0], p[1]));
    const x0 = Math.min(...ps.map(p => p[0])), x1 = Math.max(...ps.map(p => p[0])), y0 = Math.min(...ps.map(p => p[1])), y1 = Math.max(...ps.map(p => p[1])), f = mpFit(g);
    MPV.w = Math.max(f.w / 4, (x1 - x0) * 1.5, (y1 - y0) * 1.5 * 16 / 9); MPV.h = MPV.w * 9 / 16; MPV.x = (x0 + x1) / 2 - MPV.w / 2; MPV.y = (y0 + y1) / 2 - MPV.h / 2; mpClampView(); render();
  },
  mapFinish: () => {
    if (mpDraft.length < 2) return;
    if (LN[S.topic].length >= 12) { toast("Twelve lines is the most a map can hold"); return; }
    askText("Name this line", "Name", mpName(), nm => {
      if (mpDraft.length < 2) return; const id = "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      LN[S.topic].push({ id, zone: "w", name: nm.slice(0, 40), pts: mpDraft.slice() }); mpSel = id; mpDraft = []; mpTool = "edit"; mpVx = null; render(); mpSave();
    });
  },
  mapYes: () => { const cb = UI.askCb; closeModal(); if (cb) cb(); },
  mapSimplify: () => {   /* drop the points that barely bend the line (Douglas-Peucker), the ends stay */
    const l = LN[S.topic].find(x => x.id === mpSel); if (!l || l.pts.length < 4) return; const g = mpGeo(S.topic), xy = l.pts.map(p => mpXY(g, p[0], p[1])), keep = new Array(xy.length).fill(false), tol = 5;
    const dp = (a, b) => { let m = 0, k = -1; const A = xy[a], B = xy[b], vx = B[0] - A[0], vy = B[1] - A[1], L = Math.hypot(vx, vy) || 1; for (let i = a + 1; i < b; i++) { const d = Math.abs((xy[i][0] - A[0]) * vy - (xy[i][1] - A[1]) * vx) / L; if (d > m) { m = d; k = i; } } if (m > tol && k > 0) { keep[k] = true; dp(a, k); dp(k, b); } };
    keep[0] = keep[xy.length - 1] = true; dp(0, xy.length - 1); const n0 = l.pts.length; l.pts = l.pts.filter((p, i) => keep[i]); mpVx = null; render(); mpSave(); toast(n0 + " points down to " + l.pts.length);
  },
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
    const h = e.target.closest(".vh, .vm");
    if (h && ROLE !== "delegate" && mpTool === "edit" && mpSel) {
      const l = LN[S.topic].find(x => x.id === mpSel); if (!l) return;
      let i = Number(h.dataset.i);
      if (h.classList.contains("vm")) { const g = mpGeo(S.topic), a = mpXY(g, l.pts[i][0], l.pts[i][1]), b = mpXY(g, l.pts[i + 1][0], l.pts[i + 1][1]); l.pts.splice(i + 1, 0, mpLL(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); i += 1; mpVx = i; mpRedrawLines(); }
      mpDrag = { id: l.id, i, x: e.clientX, y: e.clientY, moved: false, s, added: h.classList.contains("vm") }; e.preventDefault(); return;
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
    if (!pan.moved && Math.hypot(dx, dy) < 6) return; pan.moved = true; mpDragged = true;
    const k = MPV.w / pan.s.getBoundingClientRect().width; MPV.x = pan.vx - dx * k; MPV.y = pan.vy - dy * k; mpClampView(); mpSetView(pan.s);
  });
  const end = () => { const d = mpDrag; mpDrag = null; pan = null; if (d && (d.moved || d.added)) { if (d.added) mpDragged = true; render(); mpSave(); } setTimeout(() => { mpDragged = false; }, 0); };
  window.addEventListener("resize", () => mpLabelsSoon(document.querySelector(".mapsvg")));
  document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end);
  document.addEventListener("click", e => { if (mpDragged) { e.stopPropagation(); e.preventDefault(); mpDragged = false; } }, true);
  document.addEventListener("dblclick", e => { const h = e.target.closest && e.target.closest(".vh[data-a=mapVx]"); if (h && ROLE !== "delegate") { mpVx = Number(h.dataset.i); MAPA.mapDelPt(); } });
  document.addEventListener("wheel", e => {
    const s = e.target.closest && e.target.closest(".mapsvg"); if (!s || !MPV) return; e.preventDefault();
    const b = s.getBoundingClientRect(), z = e.deltaY < 0 ? 1.15 : 0.87, px = MPV.x + (e.clientX - b.left) / b.width * MPV.w, py = MPV.y + (e.clientY - b.top) / b.height * MPV.h;
    MPV.w /= z; MPV.h /= z; MPV.x = px - (e.clientX - b.left) / b.width * MPV.w; MPV.y = py - (e.clientY - b.top) / b.height * MPV.h; mpClampView(); mpSetView(s);
  }, { passive: false });
  setInterval(() => { if (typeof UI !== "undefined" && UI.page === "map" && !document.hidden && !mpDrag && !mpDraft.length && LN) mpLoadData(true); }, 15000);
})();
