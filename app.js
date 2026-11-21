"use strict";
/* ==========================================================================
   SENTINEL JOINT OPERATIONS CENTER (HJCC force tracker)
   Storage keys keep their old hjcc-force-tracker names so saved data still loads.
   Everything lives in one object, S (both topics), saved in this browser after every change.
   Every change goes through act(): undo copy -> change -> activity log -> strength snapshot
   (feeds the charts) -> save -> redraw. Export / import JSON moves the data to another device.
   Charts come from charts.js (window.HJCCCharts), drag and drop from dnd.js (window.HJCCDnD).
   ========================================================================== */
const TOPICS = window.HJCC_TOPICS;
/* access levels (enforced in this browser and on the server): chair < admin. Delegates no longer sign in: the chairs run every force.
   DEL stays as a constant so the old one-side views are simply never drawn. */
const ROLE = (window.SentinelAuth && SentinelAuth.role()) || "chair", RANK = { chair: 0, admin: 1 };
const DEL = false;
const atLeast = r => RANK[ROLE] >= RANK[r];
const deny = () => toast("Only the Admin can do that.");
/* a unit another chair keeps (copied from the server): HP, front and battles can change here, everything else only on its owner's screen */
const foreign = u => !!(u && u.remote);
/* the cabinets (countries) of a topic, from presets.js: Topic 2 has nine, each with its own booklet. A unit may belong to one (u.cab). */
const CABS = (t) => TOPICS[t || S.topic].cabinets || [];
const cabById = (id, t) => CABS(t).find(c => c.id === id) || null;
const cabName = id => { const c = cabById(id); return c ? c.name : ""; };
const cabOpts = sel => `<option value="" ${sel ? "" : "selected"}>No country</option>` + CABS().map(c => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.name)}</option>`).join("");
/* morale by country (Topic 2): each cabinet has its own figure (50 until the chairs set it). A unit with no cabinet uses its side's morale.
   A group of units fights with the HP-weighted morale of its members. */
const hasCabs = () => CABS().length > 0;
const cabMorale = (c, d = D()) => { const v = d.cabMorale && d.cabMorale[c]; return Number.isFinite(v) ? v : 50; };
const unitMorale = (u, d = D()) => u.cab && CABS().some(c => c.id === u.cab) ? cabMorale(u.cab, d) : (d.sides[u.side] || d.sides.me).morale;
function groupMorale(U, side, d = D()) {
  if (!hasCabs() || !U.length) return d.sides[side] ? d.sides[side].morale : 50;
  const w = U.map(u => Math.max(0.01, num(u.hp))), t = sum(w); return r2(sum(U.map((u, i) => unitMorale(u, d) * w[i])) / t);
}
const cabDot = id => { const c = cabById(id); return c ? `<i class="cab-dot" style="background:${esc(c.color)}" title="${esc(c.full)}"></i>` : ""; };
const denyForeign = u => toast(`${u.name} belongs to ${u.remote}: only they can change that.`);
document.documentElement.dataset.role = ROLE;
/* forces are kept per sign-in, so two people on one browser never see each other's units */
const LEGACY_KEY = "hjcc-force-tracker-v1", KEY = LEGACY_KEY + ":" + String((window.SentinelAuth && SentinelAuth.user()) || "").toLowerCase().replace(/[^a-z0-9_.-]/g, "");
const UIKEY = "hjcc-force-tracker-ui-v1";

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const r2 = n => Math.round(num(n) * 100) / 100;
const fx = n => String(r2(n));
const f1 = n => String(Math.round(num(n) * 10) / 10);   /* percentages: 23.6, not 23.57 */
const sum = a => a.reduce((s, v) => s + num(v), 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pc = (a, b) => b > 0 ? a / b * 100 : 0;
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const other = s => s === "me" ? "foe" : "me";
const plural = (n, w, ws) => n + " " + (n === 1 ? w : (ws || w + "s"));
const sgn = n => n > 0 ? "+" + fx(n) : n < 0 ? "−" + fx(-n) : "±0";
const hhmm = t => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const countBy = (a, f) => a.reduce((o, x) => { const k = f(x); o[k] = (o[k] || 0) + 1; return o; }, {});
function ago(t) { const s = (Date.now() - t) / 1000; if (s < 45) return "just now"; if (s < 3600) return Math.round(s / 60) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago"; return new Date(t).toLocaleDateString([], { day: "numeric", month: "short" }); }

/* charts.js / dnd.js are separate files; keep the page usable if one of them fails to load */
const CH = window.HJCCCharts || { area: () => '<div class="chart-empty">Charts unavailable</div>', donut: () => "", spark: () => "", bind() {} };
const dragging = () => !!(window.HJCCDnD && HJCCDnD.active && HJCCDnD.active()) || (mpPressed > 0 && Date.now() - mpPressed < 10000);   /* mpPressed: when a finger or button went down on the battle map; the 10 s cap means a lost pointer-up can never freeze the page */

/* ---------- icons (24px line icons) ---------- */
const IC = {
  grid: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  swords: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4"/><path d="M7 17l-3 3"/><path d="M3 19l2 2"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M12 21s-7-5.2-7-11a7 7 0 0114 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  up: '<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  move: '<path d="M7 8l-4 4 4 4M17 8l4 4-4 4M3 12h18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  db: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'
};
/* icons for the battle map's hide and select toggles */
IC.eye = '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
IC.eyeoff = '<path d="M3 3l18 18M10.6 5.6A10 10 0 0 1 12 5.5C18.4 5.5 22 12 22 12a17 17 0 0 1-3.2 3.9M6.6 6.7C3.7 8.5 2 12 2 12s3.6 6.5 10 6.5a9.6 9.6 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>';
IC.checks = '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.5l3 3 5-6"/>';
const ico = k => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || ""}</svg>`;

/* ======================= STATE ======================= */
/* Default combat method. The strength table is the NTMUN II booklet's; the results chart is a placeholder until the chairs publish theirs. */
function defaultRules() {
  return {
    expr: "atk * morale / 100 * mult + bonus",
    useMorale: true, useMult: true, useBonus: false,
    useStr: true, str: [{ upTo: 10, noAtk: true, atk: 0 }, { upTo: 25, atk: -4 }, { upTo: 50, atk: -2 }, { upTo: 75, atk: -1 }],
    useMod: false, mod: [{ min: 100, mod: 2 }, { min: 75, mod: 1 }, { min: 50, mod: 0 }, { min: 10, mod: -1 }, { min: 0, mod: -2 }],
    useChart: false, chart: [
      { min: 0, tDmg: 0, aLoss: 10, note: "No effect, the attacker loses some HP" },
      { min: 10, tDmg: 100, aLoss: 0, note: "Light damage" },
      { min: 25, tDmg: 100, aLoss: 0, note: "Moderate damage" },
      { min: 50, tDmg: 100, aLoss: 0, note: "Heavy damage" },
      { min: 100, tDmg: 100, aLoss: 0, note: "Wiped out" }],
    useCounter: false, spread: "focus", rounding: "none", autoLost: true,
    deadCounter: 50, trenchCut: 50, trenchKm: 10,
    dir: { me: [], foe: [] }   /* directives: extra ATK for one side (all units, a class, or a sub class) */
  };
}
const typeRow = ([code, name, branch, atk, hp, mov, rng]) => ({ id: uid("t"), code, name, branch, atk, hp, mov, rng, ph: true });
function newTopic(k) {
  const T = TOPICS[k];
  return {
    sides: { me: { name: "My Force", morale: 50 }, foe: { name: "Enemy Force", morale: 50 } },
    alloc: { delegation: "", portfolio: "" },
    branches: T.branches.map(b => ({ ...b })),
    types: T.types.map(typeRow),
    fronts: [{ id: "reserve", name: "Reserve", fixed: true }, ...T.fronts.map(n => ({ id: uid("f"), name: n })), { id: "lost", name: "Destroyed", fixed: true }],
    units: [], battles: [], log: [], hist: [], rules: defaultRules()
  };
}
const fresh = () => ({ v: 2, topic: "t1", topics: { t1: newTopic("t1"), t2: newTopic("t2") } });
const OLD_BRANCH_COL = { "#4d5d2a": "#6b7a2a", "#1a4480": "#4f5bd5", "#8a5a00": "#c96a00", "#5b7fa6": "#0089a3" };   /* first design's defaults -> current palette */
/* v1 -> v2: classes (Army, Navy, Airforce, Marine) with sub classes, and one front instead of several.
   Demo data is simply rebuilt with the new demo; anything else keeps its units, mapped onto the new classes. */
function toV2(o) {
  const CLS = { army: "army", siege: "army", navy: "navy", air: "air", marine: "marine" };
  o.reseed = [];
  Object.keys(TOPICS).forEach(k => {
    const old = o.topics[k]; if (!old) return;
    const f = newTopic(k), keep = { sides: old.sides || f.sides, alloc: old.alloc || f.alloc, rules: Object.assign(defaultRules(), old.rules || {}) };
    if ((old.log || []).some(e => /Sample forces loaded/.test(e.m)) || !(old.units || []).length) { if ((old.units || []).length) o.reseed.push(k); o.topics[k] = Object.assign(f, keep); return; }
    const front = f.fronts[1].id;
    old.units.forEach(u => {
      u.branch = CLS[u.branch] || "army";
      const t = f.types.find(x => x.code === u.tcode); u.type = t ? t.id : ""; if (t) { u.tname = t.name; u.branch = t.branch; }
      if (u.front !== "reserve" && u.front !== "lost") u.front = front;
    });
    o.topics[k] = Object.assign(f, keep, { units: old.units, battles: old.battles || [], log: old.log || [], hist: old.hist || [] });
    addLog(o.topics[k], "Converted to classes and sub classes (Army, Navy, Airforce, Marine) and a single front line", "data");
  });
  o.v = 2;
}
function migrate(o) {
  if (!o.topics) o.topics = {};
  if ((o.v || 1) < 2) toV2(o);
  Object.keys(TOPICS).forEach(k => {
    if (!o.topics[k]) { o.topics[k] = newTopic(k); return; }
    const d = o.topics[k], f = newTopic(k);
    Object.keys(f).forEach(key => { if (d[key] === undefined) d[key] = f[key]; });
    d.rules = Object.assign(defaultRules(), d.rules || {});
    if (d.rules.trenchKm === 30 && !d.rules.trenchKm10) { d.rules.trenchKm = 10; d.rules.trenchKm10 = true; }
    d.branches.forEach(b => { const n = OLD_BRANCH_COL[String(b.color).toLowerCase()]; if (n) b.color = n; });
    d.branches.forEach(b => { if (!/^#[0-9a-f]{3,8}$/i.test(b.color)) b.color = "#8a8f98"; });   /* colours go into style="" as they are: anything in a saved or imported file that is not a plain hex colour is replaced */
    if (!d.fronts.some(x => x.id === "reserve")) d.fronts.unshift(f.fronts[0]);
    if (!d.fronts.some(x => x.id === "lost")) d.fronts.push(f.fronts[f.fronts.length - 1]);
  });
  if (!TOPICS[o.topic]) o.topic = "t1";
  return o;
}
function load() { try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); return o && o.topics ? migrate(o) : null; } catch (e) { return null; } }
let S = load() || fresh();
try { const ct = sessionStorage.getItem("sentinel-topic"); if (ct && TOPICS[ct]) { S.topic = ct; if (ROLE === "admin") sessionStorage.removeItem("sentinel-topic"); } } catch (e) {}
let lastSaved = null, saveErr = false;
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); lastSaved = Date.now(); saveErr = false; } catch (e) { saveErr = true; } renderSave();  if (typeof mpForcesPush === "function") mpForcesPush(); if (typeof rulesPush === "function") rulesPush(); }

/* per-device view state: which page, filters, battle selection, theme */
const UI = Object.assign({ page: "overview", ovSide: "me", ovMetric: "hp", boardSide: "me", q: "", br: "", rosterSide: "me", open: {}, fold: {}, sel: { att: [], def: [] }, attSide: "me", cm: { att: null, def: null }, mult: 1, bonus: 0, arty: false, theme: null, steps: true, tv: { atk: 20, morale: 60, hp: 30 } }, (() => { try { return JSON.parse(localStorage.getItem(UIKEY) || "{}") || {}; } catch (e) { return {}; } })());
UI.drawer = null; UI.colMenu = null;
function saveUI() { try { const { drawer, colMenu, askCb, ...keep } = UI; localStorage.setItem(UIKEY, JSON.stringify(keep)); } catch (e) { /* view state is a convenience only */ } }

/* While a page is drawn for one country (the country switch on Overview, Forces and Order of Battle), D() hands back a view of the topic that holds
   only that country's units, battles and history. It exists only during the drawing: clicks and edits always work on the whole topic. */
let VIEW = null;
const D = () => VIEW && VIEW.src === S.topics[S.topic] ? VIEW.d : S.topics[S.topic];
const byId = id => D().units.find(u => u.id === id);
const strOf = u => u.maxhp > 0 ? clamp(u.hp / u.maxhp * 100, 0, 100) : 0;
const lost = u => u.front === "lost" || !(u.hp > 0);
const branchById = id => D().branches.find(b => b.id === id) || { id: "", name: "Other", color: "#6b7380" };
const frontById = id => D().fronts.find(f => f.id === id);
const frontName = id => (frontById(id) || { name: "Reserve" }).name;
/* a chair is neutral, like the UN: sides carry the names of the topic, never "my force" / "enemy force" */
const CHAIR_SIDES = { t1: { me: "French Army", foe: "British Army", ne: "Neutral" }, t2: { me: "Allied Powers", foe: "Central Powers", ne: "Neutral" } };
const sideLbl = s => ROLE === "chair" && CHAIR_SIDES[S.topic] ? CHAIR_SIDES[S.topic][s] : D().sides[s].name || (s === "me" ? "My Force" : "Enemy Force");
const sideWord = s => ROLE === "chair" ? sideLbl(s) : s === "me" ? "own" : "enemy";
const sideCol = s => s === "me" ? "var(--me)" : s === "ne" ? "#8a91a0" : "var(--foe)";
const topicLbl = () => { const T = TOPICS[S.topic]; return `Topic ${T.num} · ${T.title} (${T.year})`; };
const byOrd = (a, b) => (num(a.ord, 1e9) - num(b.ord, 1e9)) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
const TIER_L = { full: "Full strength", good: "75–99%", fair: "50–74%", weak: "10–49%", crit: "Under 10%", lost: "Destroyed" };
const tierKey = s => s >= 99.95 ? "full" : s >= 75 ? "good" : s >= 50 ? "fair" : s >= 10 ? "weak" : "crit";
const tierOf = u => lost(u) ? "lost" : tierKey(strOf(u));
const TIER_ORDER = { full: 0, good: 1, fair: 2, weak: 3, crit: 4, lost: 5 };
const byStr = (a, b) => (TIER_ORDER[tierOf(a)] - TIER_ORDER[tierOf(b)]) || (strOf(b) - strOf(a));

/* the most a unit's stats can be; the server keeps the same limits on the copies it stores, so a bigger figure here would show differently to the chairs */
const STAT_MAX = 1000, HP_MAX = 100000;
/* ---------- change pipeline ---------- */
const UNDO = [];
function act(msg, fn, kind = "edit") {
  UNDO.push(JSON.stringify(S)); if (UNDO.length > 80) UNDO.shift();
  fn(D());
  const d = D();
  if (msg) addLog(d, msg, kind);
  snap(d); save(); render();
}
function undo() {
  if (!UNDO.length) { toast("Nothing to undo"); return; }
  S = JSON.parse(UNDO.pop()); save(); render(); toast("Undone");
}
function addLog(d, m, k) { d.log.unshift({ t: Date.now(), m, k }); if (d.log.length > 600) d.log.length = 600; }
function sideSnap(d, s) {
  const U = d.units.filter(u => u.side === s), A = U.filter(u => !lost(u));
  return { hp: r2(sum(A.map(u => u.hp))), max: r2(sum(U.map(u => u.maxhp))), n: A.length, atk: r2(sum(A.map(u => eff(u, d.rules).eff))) };
}
/* one point per change of the totals: this history is what the "strength over time" charts draw */
function cabSnap(d, c) {
  const U = d.units.filter(u => u.cab === c), A = U.filter(u => !lost(u));
  return { hp: r2(sum(A.map(u => u.hp))), max: r2(sum(U.map(u => u.maxhp))), n: A.length, atk: r2(sum(A.map(u => eff(u, d.rules).eff))) };
}
function snap(d) {
  const p = { t: Date.now(), me: sideSnap(d, "me"), foe: sideSnap(d, "foe") }, l = d.hist[d.hist.length - 1];
  const cs = [...new Set(d.units.map(u => u.cab).filter(Boolean))]; if (cs.length) { p.cab = {}; cs.forEach(c => { p.cab[c] = cabSnap(d, c); }); }   /* per country, for the country switch */
  if (l && JSON.stringify([l.me, l.foe, l.cab || null]) === JSON.stringify([p.me, p.foe, p.cab || null])) return;
  d.hist.push(p); if (d.hist.length > 500) d.hist.splice(0, d.hist.length - 500);
}
function setHp(d, u, v) {
  u.hp = clamp(r2(v), 0, num(u.maxhp));
  if (!(u.hp > 0)) { if (d.rules.autoLost) u.front = "lost"; }
  else if (u.front === "lost") u.front = "reserve";
}
function moveTo(d, u, f) {
  if (u.front === f) return;
  u.front = f; u.ord = 1 + Math.max(0, ...d.units.filter(x => x.front === f && x !== u).map(x => num(x.ord)));
  if (f === "lost") u.hp = 0;
  else if (!(u.hp > 0)) u.hp = Math.min(1, u.maxhp);
}
/* a sub class as one country has it: the booklet's base stats with that country's own ATK / HP / MOV / RNG on top (d.cabTypes[cabinet][sub class id]) */
const typeFor = (d, t, c) => { const o = t && c && d.cabTypes && d.cabTypes[c] && d.cabTypes[c][t.id]; return o ? Object.assign({}, t, o) : t; };
function mkUnit(d, o) {
  const t = o.t ? typeFor(d, o.t, o.cab) : o.t;
  return {
    id: uid("u"), side: o.side, name: o.name, type: t ? t.id : "", tcode: t ? t.code : "", tname: t ? t.name : "Custom unit",
    branch: t ? t.branch : (o.branch || d.branches[0].id),
    hp: num(o.hp, t ? t.hp : 1), maxhp: num(o.maxhp, t ? t.hp : 1), atk: num(o.atk, t ? t.atk : 0), mov: num(o.mov, t ? t.mov : 0), rng: num(o.rng, t ? t.rng : 0),
    front: o.front || "reserve", ord: 1 + Math.max(0, ...d.units.filter(x => x.front === (o.front || "reserve")).map(x => num(x.ord))), notes: o.notes || "", cab: o.cab || ""
  };
}
function nextNum(d, base) { const re = new RegExp("^" + reEsc(base) + " (\\d+)$"); let m = 0; d.units.forEach(u => { const x = re.exec(u.name); if (x) m = Math.max(m, +x[1]); }); return m + 1; }
function tot(s) {
  const U = D().units.filter(u => u.side === s), A = U.filter(u => !lost(u)), R = D().rules;
  return { all: U.length, n: A.length, lost: U.length - A.length, hp: r2(sum(A.map(u => u.hp))), max: r2(sum(U.map(u => u.maxhp))), maxA: r2(sum(A.map(u => u.maxhp))), atk: r2(sum(A.map(u => eff(u, R).eff))), atkField: r2(sum(A.filter(u => u.front !== "reserve").map(u => eff(u, R).eff))), reserve: A.filter(u => u.front === "reserve").length };
}

/* ======================= COMBAT RULES ENGINE ======================= */
const STD_EXPR = "atk * morale / 100 * mult + bonus";
const FORMULAS = {
  standard: { name: "Attack × Morale", desc: "Total effective attack scaled by the attacker's morale. The usual crisis method.", expr: STD_EXPR, morale: true },
  nomorale: { name: "Attack only", desc: "For when the chairs take morale out of combat. Also switches the Morale term off.", expr: "atk * mult + bonus", morale: false }
};
const VARS = [["atk", "Effective attack of the attacking units, together"], ["base", "Their attack before the strength rules"], ["morale", "Attacker morale % (100 when Morale is off)"], ["mult", "Situational multiplier (1 when off)"], ["bonus", "Flat bonus damage (0 when off)"], ["hp", "Defenders' current HP, together"], ["maxhp", "Defenders' full HP, together"], ["n", "Number of attacking units"], ["m", "Number of defending units"], ["datk", "Defenders' effective attack, together"], ["str", "Attackers' average strength %"]];
const FN = { min: Math.min, max: Math.max, round: Math.round, floor: Math.floor, ceil: Math.ceil, abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow, clamp: (x, a, b) => Math.max(a, Math.min(b, x)), if: (c, a, b) => c ? a : b };
const SPREAD = { focus: "Focus fire", even: "Even split", prop: "Proportional" };
const SPREAD_S = { focus: "in the order you tick the defenders (the first takes it all, the rest carries over to the next)", even: "evenly over the defenders", prop: "in proportion to each defender's HP" };
const RND = { none: "not rounded", round: "rounded to the nearest whole number", floor: "rounded down", ceil: "rounded up" };
const RULE_L = { useMorale: "Morale in combat", useMult: "Situational multiplier", useBonus: "Flat bonus damage", useStr: "Strength penalty", useMod: "Combat modifier", useChart: "Results chart", useCounter: "Counter-attack", autoLost: "Move units at 0 HP to Destroyed" };
const TBL_L = { str: "strength penalty", mod: "combat modifier", chart: "results chart" };

/* A small, safe formula language (no eval): numbers, the names in VARS, + - * / % ^, comparisons (true = 1), ( ) and the functions in FN. */
function compile(src) {
  const toks = [], re = /\s*(?:(\d+\.?\d*|\.\d+)|([A-Za-z_]\w*)|(>=|<=|==|!=|[-+*/%^(),<>]))/y;
  src = String(src || ""); let i = 0;
  while (i < src.length) {
    re.lastIndex = i; const m = re.exec(src);
    if (!m) { if (/^\s*$/.test(src.slice(i))) break; throw new Error(`I don't understand “${src.slice(i).trim()[0]}”`); }
    i = re.lastIndex;
    toks.push(m[1] != null ? { t: "n", v: parseFloat(m[1]) } : m[2] != null ? { t: "id", v: m[2] } : { t: "op", v: m[3] });
  }
  if (!toks.length) throw new Error("The formula is empty");
  let p = 0;
  const take = v => { const t = toks[p]; if (t && t.t === "op" && t.v === v) { p++; return true; } return false; };
  const need = v => { if (!take(v)) throw new Error(`Expected “${v}”`); };
  const CMP = { ">": (a, b) => a > b, "<": (a, b) => a < b, ">=": (a, b) => a >= b, "<=": (a, b) => a <= b, "==": (a, b) => a === b, "!=": (a, b) => a !== b };
  function cmp() { let a = add(); for (;;) { const t = toks[p]; if (t && t.t === "op" && CMP[t.v]) { p++; const f = CMP[t.v], x = a, b = add(); a = V => f(x(V), b(V)) ? 1 : 0; } else return a; } }
  function add() { let a = mul(); for (;;) { if (take("+")) { const x = a, b = mul(); a = V => x(V) + b(V); } else if (take("-")) { const x = a, b = mul(); a = V => x(V) - b(V); } else return a; } }
  function mul() { let a = un(); for (;;) { if (take("*")) { const x = a, b = un(); a = V => x(V) * b(V); } else if (take("/")) { const x = a, b = un(); a = V => { const q = b(V); return q === 0 ? 0 : x(V) / q; }; } else if (take("%")) { const x = a, b = un(); a = V => { const q = b(V); return q === 0 ? 0 : x(V) % q; }; } else return a; } }
  function un() { if (take("-")) { const x = un(); return V => -x(V); } if (take("+")) return un(); return pw(); }
  function pw() { const a = prim(); if (take("^")) { const b = un(); return V => Math.pow(a(V), b(V)); } return a; }
  function prim() {
    const t = toks[p++]; if (!t) throw new Error("The formula ends too early");
    if (t.t === "n") { const v = t.v; return () => v; }
    if (t.t === "op" && t.v === "(") { const e = cmp(); need(")"); return e; }
    if (t.t === "id") {
      const k = t.v.toLowerCase();
      if (take("(")) {
        const f = FN[k]; if (!f) throw new Error(`Unknown function “${t.v}”`);
        const args = []; if (!take(")")) { do args.push(cmp()); while (take(",")); need(")"); }
        return V => f(...args.map(g => g(V)));
      }
      if (!VARS.some(v => v[0] === k)) throw new Error(`Unknown name “${t.v}”`);
      return V => num(V[k]);
    }
    throw new Error(`Unexpected “${t.v}”`);
  }
  const f = cmp(); if (p < toks.length) throw new Error(`Unexpected “${toks[p].v}”`);
  return f;
}
const STD = compile(STD_EXPR);
/* A formula can be well formed and still be no use: "atk / 0" works out to 0 (dividing by zero counts as 0 here), so every attack would do nothing.
   Try it on an ordinary attack and say so; it is a warning, the formula is still used as written. */
function exprWarn(f) {
  let v; try { v = f({ atk: 20, base: 20, morale: 60, mult: 1, bonus: 0, hp: 30, maxhp: 30, n: 1, m: 1, datk: 10, str: 100 }); } catch (e) { v = NaN; }
  return Number.isFinite(v) && v > 0 ? "" : " Careful: for an ordinary attack (ATK 20, morale 60%) it gives no damage.";
}
const FCACHE = { src: null, f: null, err: null };
function formula(R) { if (FCACHE.src !== R.expr) { FCACHE.src = R.expr; try { FCACHE.f = compile(R.expr); FCACHE.err = null; } catch (e) { FCACHE.f = null; FCACHE.err = e.message; } } return FCACHE; }
const exprVars = expr => { const s = new Set(); String(expr).replace(/[A-Za-z_]\w*/g, w => { const k = w.toLowerCase(); if (VARS.some(v => v[0] === k)) s.add(k); return w; }); return [...s]; };

function strPen(s, R) { for (const r of (R.str || []).slice().sort((a, b) => num(a.upTo) - num(b.upTo))) { if (r.noAtk ? s < num(r.upTo) : s <= num(r.upTo)) return { none: !!r.noAtk, atk: r.noAtk ? 0 : num(r.atk) }; } return { none: false, atk: 0 }; }
function cmod(s, R) { const t = (R.mod || []).slice().sort((a, b) => num(b.min) - num(a.min)).find(r => s >= num(r.min) - 1e-9); return t ? num(t.mod) : 0; }
/* a unit's attack in combat, after the strength rules that are switched on */
function eff(u, R) {
  R = R || D().rules; const dir = sideDir(u, R), base = num(u.atk) + dir, s = strOf(u); let e = base, pen = 0, mod = 0, none = false;
  if (R.useStr) { const p = strPen(s, R); if (p.none) { none = true; e = 0; } else { pen = p.atk; e += p.atk; } }
  if (R.useMod && !none) { mod = cmod(s, R); e += mod; }
  return { base, eff: Math.max(0, r2(e)), pen, mod, none, s, dir };
}
/* a side's standing orders: +2 ATK to its standard infantry, say */
const sideDir = (u, R) => sum(((R.dir && R.dir[u.side]) || []).filter(e => e.t === "*" || e.t === "b:" + u.branch || e.t === "c:" + u.tcode).map(e => num(e.atk)));
const chartSorted = R => (R.chart || []).slice().sort((a, b) => num(a.min) - num(b.min));
function chartRow(p, R) { const c = chartSorted(R); let row = c[0] || null; c.forEach(b => { if (p >= num(b.min)) row = b; }); return row; }
function rowLabel(R, row) { const c = chartSorted(R), i = c.indexOf(row), lo = num(row.min), hi = c[i + 1] ? num(c[i + 1].min) : null; return hi == null ? `${fx(lo)}% and over` : lo <= 0 ? `under ${fx(hi)}%` : `${fx(lo)}% to ${fx(hi)}%`; }
const roundBy = (v, m) => m === "round" ? Math.round(v) : m === "floor" ? Math.floor(v) : m === "ceil" ? Math.ceil(v) : r2(v);

/* one side hitting the other: effective attack -> formula -> (results chart) */
function strike(att, def, morale, mult, bonus, R) {
  const parts = att.map(u => { const e = eff(u, R), k = u._k == null ? 1 : u._k; return k === 1 ? { u, ...e } : { u, ...e, eff: r2(e.eff * k), base: r2(e.base * k), k }; });
  const V = { atk: sum(parts.map(x => x.eff)), base: sum(parts.map(x => x.base)), morale: R.useMorale ? clamp(num(morale, 50), 0, 100) : 100, mult: R.useMult ? Math.max(0, num(mult, 1)) : 1, bonus: R.useBonus ? num(bonus, 0) : 0,
    hp: sum(def.map(u => u.hp)), maxhp: sum(def.map(u => u.maxhp)), n: att.length, m: def.length, datk: sum(def.map(u => eff(u, R).eff)), str: att.length ? sum(parts.map(x => x.s)) / att.length : 0 };
  const F = formula(R); let raw; try { raw = (F.f || STD)(V); } catch (e) { raw = 0; }
  if (!Number.isFinite(raw)) raw = 0; raw = Math.max(0, raw);
  const dmg = roundBy(raw, R.rounding), pct = V.hp > 0 ? dmg / V.hp * 100 : 0;
  let row = null, dealt = dmg, self = 0;
  if (R.useChart) { row = chartRow(pct, R); if (row) { dealt = roundBy(dmg * num(row.tDmg, 100) / 100, R.rounding); self = num(row.aLoss, 0); } }
  return { parts, V, raw, dmg, pct, row, dealt, self, ferr: F.err };
}
function spread(list, h, dmg, mode) {
  let left = Math.max(0, num(dmg)); const alive = () => list.filter(u => h.get(u.id) > 1e-9);
  if (mode === "even") { let g = 0; while (left > 1e-9 && alive().length && g++ < 60) { const al = alive(), sh = left / al.length; left = 0; al.forEach(u => { const v = h.get(u.id), t = Math.min(v, sh); h.set(u.id, v - t); left += sh - t; }); } }
  else if (mode === "prop") { const total = sum(list.map(u => h.get(u.id))); if (total > 0) { const f = Math.min(1, left / total); list.forEach(u => h.set(u.id, h.get(u.id) * (1 - f))); left = Math.max(0, left - total); } }
  else { for (const u of list) { if (left <= 1e-9) break; const v = h.get(u.id), t = Math.min(v, left); h.set(u.id, v - t); left -= t; } }
  return r2(left);
}
/* artillery rule: sub class codes that count as artillery, and the option "artillery only hits": it still deals its damage but takes none this engagement (no counter-attack damage, no results-chart loss, no damage when it is the one attacked) */
const ARTY = ["ART", "SAP"];
const isArty = u => !!u && ARTY.includes(u.tcode);
const noHit = x => ({ ...x, dealt: 0, dmg: 0, pct: 0, self: 0, row: null });
/* weak / fortified points (placed by the chairs on the battle map): a unit whose map marker stands inside a circle takes ZONE_WEAK more damage in a weak one and ZONE_FORT less in a fortified one.
   It only applies to a unit that actually took damage, never below 0 or above the HP it had, and a unit inside one of each nets +2 - 5. Units not placed on the map are never in a circle. */
const ZONE_WEAK = 2, ZONE_FORT = 5;
function zoneNet(u) {
  const pts = (typeof PTS !== "undefined" && PTS[S.topic]) || [], m = (typeof TR !== "undefined" && TR[S.topic] || []).find(x => x.uid === u.id);
  if (!m || !pts.length) return 0;
  const inside = k => pts.some(q => q.kind === k && mpKm(m.lat, m.lon, q.lat, q.lon) <= q.r);
  return (inside("weak") ? ZONE_WEAK : 0) - (inside("fort") ? ZONE_FORT : 0);
}
/* trenches (drawn by the chairs on the battle map, map.js): a defender whose marker stands in a trench of its own side takes the rules' trenchCut % less damage */
function trenchOfUnit(u) {
  if (typeof mpTrenchOf !== "function" || typeof TR === "undefined") return null;
  const m = (TR[S.topic] || []).find(x => x.uid === u.id); return m ? mpTrenchOf(S.topic, m) : null;
}
/* h0: HP before this step, h: HP after it; moves every damaged unit's HP by its zone net and notes it in fx.
   tfx (defenders only): the trench cut comes first, then the weak / fortified point; what the trench saved is noted in tfx */
function zoneAdjust(units, h0, h, fx, tfx) {
  const cut = clamp(num(D().rules.trenchCut, 50), 0, 100) / 100;
  units.forEach(u => {
    const a = h0.get(u.id), b = h.get(u.id); let lostHp = a - b; if (!(lostHp > 1e-9)) return;
    const tr = tfx && cut > 0 ? trenchOfUnit(u) : null;
    if (tr) { const kept = lostHp * cut; lostHp -= kept; h.set(u.id, a - lostHp); const o = tfx.get(u.id) || { name: tr.name, tier: tr.tier, saved: 0 }; o.saved = r2(o.saved + kept); tfx.set(u.id, o); }
    const net = zoneNet(u); if (!net) return;
    const to = Math.min(a, Math.max(0, lostHp + net)); h.set(u.id, a - to); fx.set(u.id, (fx.get(u.id) || 0) + (to - lostHp));
  });
}
/* the whole engagement, worked out on copies: nothing changes until commitBattle() */
function resolve(attIds, defIds, o) {
  const d = D(), R = d.rules, get = o.get || (id => d.units.find(u => u.id === id));
  const A = attIds.map(get).filter(u => u && !lost(u)), B = defIds.map(get).filter(u => u && !lost(u));
  if (!A.length || !B.length) return null;
  /* shore rule: troops on land (Army, Marine) cannot damage ships. When a ship is attacked only by land troops, or ships attack a shore, the land side's attack is struck out; land troops still fully damage hostiles on the shore. */
  const blocked = (from, to) => to.length && to.every(u => u.branch === "navy") ? from.filter(u => u.branch !== "navy" && u.branch !== "air") : [], bA = blocked(A, B), bB = blocked(B, A);
  /* artillery that "only hits" is left out of everything that damages its side */
  const safe = new Set(o.artySafe ? A.concat(B).filter(isArty).map(u => u.id) : []), dA = A.filter(u => !safe.has(u.id)), dB = B.filter(u => !safe.has(u.id));
  let main = strike(A.filter(u => !bA.includes(u)), dB, o.am, o.mult, o.bonus, R);
  if (!dB.length) main = noHit(main);
  const hA = new Map(A.map(u => [u.id, num(u.hp)])), hB = new Map(B.map(u => [u.id, num(u.hp)]));
  const zfx = new Map(), tfx = new Map(), hB0 = new Map(hB), over = dB.length ? spread(dB, hB, main.dealt, R.spread) : 0;
  zoneAdjust(dB, hB0, hB, zfx, tfx);
  if (main.self > 0) dA.forEach(u => hA.set(u.id, Math.max(0, hA.get(u.id) - num(u.hp) * main.self / 100)));
  /* counter-attack: every defender still standing after the hit strikes back at full strength, even one with a sliver of HP left (and even if it took no damage).
     One reduced to 0 still strikes back, at deadCounter % of its attack (the chairs' rule: 50% by default; 0 turns it off). */
  const dk = clamp(num(R.deadCounter, 50), 0, 100) / 100, can = B.filter(u => !bB.includes(u));
  const stand = can.filter(u => hB.get(u.id) > 1e-9).concat(dk > 0 ? can.filter(u => !(hB.get(u.id) > 1e-9)).map(u => ({ ...u, _k: dk })) : []);
  let counter = R.useCounter ? strike(stand, dA, o.dm, 1, 0, R) : null;
  if (counter && !stand.length) counter = { ...noHit(counter), none: true };
  else if (counter && !dA.length) counter = { ...noHit(counter), safe: true };
  let overC = 0;
  if (counter && dA.length) { overC = spread(dA, hA, counter.dealt, R.spread); if (counter.self > 0) { const b1 = new Map(hB); dB.forEach(u => hB.set(u.id, Math.max(0, hB.get(u.id) - num(u.hp) * counter.self / 100))); zoneAdjust(dB, b1, hB, zfx, tfx); } }
  zoneAdjust(dA, new Map(A.map(u => [u.id, num(u.hp)])), hA, zfx);
  [hA, hB].forEach(h => h.forEach((v, k) => h.set(k, Math.max(0, r2(v)))));
  return { A, B, main, counter, hA, hB, over, overC, safe, zfx, tfx, noShip: [...bA, ...bB] };
}
const zoneNote = (r, u) => { const z = r.zfx && r.zfx.get(u.id), t = r.tfx && r.tfx.get(u.id); return (t ? ` (in the ${esc(t.name)}: −${fx(t.saved)} damage)` : "") + (z ? ` (${z > 0 ? "weak point" : "fortified point"}: ${z > 0 ? "+" : "−"}${fx(Math.abs(z))} damage)` : ""); };
const grpNames = L => L.length === 1 ? L[0].name : `${L[0].name} +${L.length - 1}`;
function battleMsg(r) {
  const kd = r.B.filter(u => !(r.hB.get(u.id) > 0)).length, ka = r.A.filter(u => !(r.hA.get(u.id) > 0)).length;
  return `Battle: ${grpNames(r.A)} attacked ${grpNames(r.B)} · ${fx(r.main.dealt)} damage (${f1(r.main.pct)}% of their HP)` + (r.counter ? ` · counter-attack ${fx(r.counter.dealt)}` : "") + (kd ? ` · ${plural(kd, "defender")} destroyed` : "") + (ka ? ` · ${plural(ka, "attacker")} destroyed` : "") + (r.safe && r.safe.size ? " · artillery only hit (took no damage)" : "");
}
function commitBattle(d, r) {
  const rec = { id: uid("b"), t: Date.now(), aSide: r.A[0].side, dSide: r.B[0].side, am: r.main.V.morale, dmg: r.main.dealt, pct: r2(r.main.pct), cdmg: r.counter ? r.counter.dealt : null,
    att: r.A.map(u => ({ id: u.id, name: u.name, b: r2(u.hp), a: r.hA.get(u.id) })), def: r.B.map(u => ({ id: u.id, name: u.name, b: r2(u.hp), a: r.hB.get(u.id) })) };
  [[r.A, r.hA], [r.B, r.hB]].forEach(([L, h]) => L.forEach(u0 => { const u = d.units.find(x => x.id === u0.id); if (u) setHp(d, u, h.get(u.id)); }));
  rec.lostA = rec.att.filter(x => !(x.a > 0)).length; rec.lostD = rec.def.filter(x => !(x.a > 0)).length;
  d.battles.unshift(rec); if (d.battles.length > 300) d.battles.length = 300;
  return rec;
}
/* the battle currently set up on the calculator / tray */
function selNow() {
  const d = D(), aS = UI.attSide === "foe" ? "foe" : "me", ok = (id, s) => { const u = d.units.find(x => x.id === id); return u && u.side === s && !lost(u) ? u : null; };
  return { aS, dS: other(aS), A: UI.sel.att.map(id => ok(id, aS)).filter(Boolean), D: UI.sel.def.map(id => ok(id, other(aS))).filter(Boolean) };
}
function moraleNow(w) { const s = selNow(), side = w === "att" ? s.aS : s.dS; return UI.cm[w] != null ? UI.cm[w] : groupMorale(w === "att" ? s.A : s.D, side); }
/* where the morale in the calculator comes from, for its "use ..." link */
const moraleSrc = (w, s) => { const U = w === "att" ? s.A : s.D, side = w === "att" ? s.aS : s.dS; if (!hasCabs()) return sideLbl(side); const cs = [...new Set(U.map(u => u.cab).filter(c => cabById(c)))]; return cs.length === 1 ? cabName(cs[0]) : cs.length ? "their countries" : sideLbl(side); };
function currentResult() { const s = selNow(); return s.A.length && s.D.length ? resolve(s.A.map(u => u.id), s.D.map(u => u.id), { am: moraleNow("att"), dm: moraleNow("def"), mult: UI.mult, bonus: UI.bonus, artySafe: UI.arty }) : null; }
function applyBattle() {
  const r = currentResult(); if (!r) return;
  const msg = battleMsg(r);
  act(null, d => { commitBattle(d, r); addLog(d, msg, "battle"); }, "battle");
  const live = id => { const u = byId(id); return u && !lost(u); };
  UI.sel.att = UI.sel.att.filter(live); UI.sel.def = UI.sel.def.filter(live); saveUI(); render();
  toast(ROLE === "chair" ? "Battle result applied to both sides" : "Battle result applied to your forces");
}

/* ======================= RENDER ======================= */
const PAGES = [
  { id: "overview", name: "Overview", icon: "grid" },
  { id: "forces", name: "Forces", icon: "layers" },
  { id: "board", name: "Order of Battle", icon: "board" },
  { id: "morale", name: "Morale", icon: "pulse" },
  { id: "map", name: "War Map", icon: "map" },
  { id: "combat", name: "Combat Calculator", icon: "swords" },
  { id: "sides", name: "Sides by day", icon: "board" },
  { id: "rules", name: "Rules & Formulas", icon: "sliders" },
  { id: "settings", name: "Allocation & Data", icon: "cog" }
];
/* the Administrator runs the committee, not a side: accounts, access, topics and rules live in one control panel */
const ADMIN_PAGES = [{ id: "status", name: "System status", icon: "pulse" }, { id: "control", name: "Control Panel", icon: "cog" }, { id: "sides", name: "Sides by day", icon: "board" }, { id: "rules", name: "Rules & Formulas", icon: "sliders" }];
const pages = () => ROLE === "admin" ? ADMIN_PAGES : PAGES.filter(p => p.id !== "settings");   /* a chair gets every page but the admin's settings */
const seg = (a, opts, cur, key) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${v === cur ? "on" : ""}" data-a="${a}" data-${key}="${v}" aria-pressed="${v === cur}">${esc(l)}</button>`).join("")}</div>`;
const swBtn = (k, on) => `<span class="sw-w">${on ? "ON" : "OFF"}<button class="sw ${on ? "on" : ""}" role="switch" aria-checked="${!!on}" aria-label="${esc(RULE_L[k] || k)}" data-a="rule" data-k="${k}"><i></i></button></span>`;
const frontOpts = (cur, noLost) => D().fronts.filter(f => !(noLost && f.id === "lost")).map(f => `<option value="${f.id}" ${f.id === cur ? "selected" : ""}>${esc(f.name)}</option>`).join("");
const typeOpts = cur => D().branches.map(b => { const T = D().types.filter(t => t.branch === b.id); return T.length ? `<optgroup label="${esc(b.name)}">${T.map(t => `<option value="${t.id}" ${t.id === cur ? "selected" : ""}>${esc(t.name)} (${esc(t.code)})</option>`).join("")}</optgroup>` : ""; }).join("") + (() => { const O = D().types.filter(t => !D().branches.some(b => b.id === t.branch)); return O.length ? `<optgroup label="Other">${O.map(t => `<option value="${t.id}" ${t.id === cur ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</optgroup>` : ""; })();

/* access levels: the Admin runs rules, data and accounts; a chair runs every force, the map, morale, sides, rules and the combat calculator.
   Only the admin-only buttons (data-need) are locked here. */
function lockPage() {
  $("page").querySelectorAll("[data-need]").forEach(b => { if (ROLE !== "admin") { b.disabled = true; b.classList.add("locked"); b.title = "Admin access needed"; } });
}
function accessPanel() {
  const cols = ["chair", "admin"], rows = [
    ["See forces, order of battle, battle overview and charts", [1, 0]],
    ["Add, edit and move units; load booklet forces; apply battle results; set fronts", [1, 0]],
    ["Use the combat calculator", [1, 0]],
    ["Set morale and sides by day; draw the battle map and place troops", [1, 0]],
    ["Edit rules, formulas, classes and sub classes", [1, 1]],
    ["Create, reset and remove accounts; import backups; clear data", [0, 1]]
  ], cap = x => x[0].toUpperCase() + x.slice(1);
  const tbl = `<table class="rtbl acc"><thead><tr><th>What you can do</th>${cols.map(c => `<th class="${c === ROLE ? "me" : ""}">${cap(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td>${cols.map((c, i) => `<td class="${c === ROLE ? "me" : ""}">${r[1][i] ? "Yes" : "&mdash;"}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  return `<section class="panel"><div class="panel-h"><div><h3>${ROLE === "admin" ? "Access levels" : "Your access: " + cap(ROLE)}</h3><p>The Admin runs the committee and does not command a side. Delegates no longer sign in: the chairs command every side's forces and run the map, morale, sides, rules and combat calculator. Each chair's units are shared with the other chairs, who see them but cannot change them. Rules and formulas are shared: a change by the Admin or a chair reaches every screen.</p></div></div>${tbl}</section>`;
}

/* ---------- ADMIN: control panel ---------- */
let ACC = null, accErr = "", ALLOC = null, MINE = null, SD = null, sdPick = null;
/* allocation sheet: the admin gives each delegate a character; the delegate's sidebar and side name follow it */
function loadAlloc() {
  return SentinelAuth.api("GET", "/api/allocation").then(r => r.ok ? r.json() : null).then(j => {
    if (!j) { if (!ALLOC) ALLOC = { chars: [], mine: {}, assigned: {} }; return; }
    ALLOC = j;
    if (ROLE === "delegate" && Object.keys(j.mine || {}).length) {
      SentinelAuth.api("GET", "/api/sides").then(r => r.ok ? r.json() : null).then(k => {
        if (!k || !k.mine) return;
        MINE = k.mine;
        Object.keys(k.mine).forEach(t => {
          const m = k.mine[t], d = S.topics[t], lab = m.label, por = lab + " · Day " + m.day;
          if (d && (d.alloc.delegation !== m.char || d.alloc.portfolio !== por || d.sides.me.name !== lab)) { d.alloc.delegation = m.char; d.alloc.portfolio = por; d.sides.me.name = lab; save(); }
        });
        render();
      }, () => {});
    }
    render();
  }, () => {});
}
/* ---------- SYSTEM STATUS: who is online and how the database is doing, refreshed every few seconds ---------- */
let ST = null, STH = { lat: [], on: [] }, stT = 0, stErr = "";
function loadStatus() {
  return SentinelAuth.api("GET", "/api/status").then(r => r.ok ? r.json() : Promise.reject(), () => Promise.reject()).then(j => {
    ST = j; stErr = ""; STH.lat.push(j.latency); STH.on.push(j.online.length); if (STH.lat.length > 30) { STH.lat.shift(); STH.on.shift(); }
    if (UI.page === "status" && !document.querySelector("#page :focus")) render();
  }, () => { stErr = "Could not reach the server."; if (UI.page === "status") render(); });
}
const fmtB = n => n == null ? "—" : n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : n < 1073741824 ? (n / 1048576).toFixed(1) + " MB" : (n / 1073741824).toFixed(2) + " GB";
const fmtUp = s => s == null ? "—" : s < 3600 ? Math.round(s / 60) + " min" : s < 172800 ? (s / 3600).toFixed(1) + " h" : Math.round(s / 86400) + " days";
function pgStatus() {
  if (!stT) { stT = 1; loadStatus(); }
  const head = `<div class="pg-head"><div><div class="eyebrow">Administrator</div><h2 class="pg-h">System status</h2><p class="pg-p">Live view of who is online and how the database and server are doing. Updates every 5 seconds while this page is open.</p></div></div>`;
  if (!ST) return head + `<section class="panel"><p class="muted">${esc(stErr || "Loading…")}</p></section>`;
  const d = ST.db, f = ST.fn, st = d.st, hit = st && st.hit + st.read ? (100 * st.hit / (st.hit + st.read)).toFixed(1) + "%" : "—";
  const lat = ST.latency, latC = lat < 80 ? "var(--ok, #2f9e5b)" : lat < 250 ? "var(--accent)" : "var(--foe)";
  const tile = (c, l, v, sub, sp) => `<div class="tile" style="--tc:${c}"><div class="t-top"><span class="l">${l}</span></div><div class="v">${v}</div><div class="s">${sub}</div>${sp && sp.length > 1 ? CH.spark(sp) : ""}</div>`;
  const tiles = [
    tile("var(--accent)", "Online now", ST.online.length, `of ${plural(ST.accounts, "account")}`, STH.on),
    tile(latC, "Database response", lat + " ms", d.kind === "postgres" ? "one query, round trip" : "local file", STH.lat),
    tile("var(--ink-3)", "Database size", fmtB(d.size), d.kind === "postgres" ? "Postgres on Neon" : "local dev file"),
    tile("var(--ink-3)", "Connections", d.conn ? d.conn.total : "—", d.conn ? d.conn.active + " running a query" : "not reported")
  ].join("");
  const who = ST.online.length ? ST.online.map(o => `<tr><td>${esc(o.u)}${o.u === SentinelAuth.user() ? ' <span class="muted">(you)</span>' : ""}</td><td>${esc(o.role[0].toUpperCase() + o.role.slice(1))}</td><td>${o.topic && TOPICS[o.topic] ? esc(TOPICS[o.topic].title) : "—"}</td><td>${esc((pages().concat(PAGES).find(p => p.id === o.page) || {}).name || o.page || "—")}</td><td class="muted">${o.ago < 10 ? "just now" : o.ago + " s ago"}</td></tr>`).join("") : `<tr><td colspan="5" class="muted">Nobody else is online.</td></tr>`;
  const tb = (d.tables || []).map(t => `<tr><td>${esc(t.name.replace(/^sentinel_/, ""))}</td><td>${t.rows}</td><td>${fmtB(t.size)}</td></tr>`).join("");
  const memPct = Math.min(100, Math.round(100 * f.heap / f.heapTotal));
  const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  return head + `<section class="tiles">${tiles}</section>
  <section class="panel"><div class="panel-h"><div><h3>Online now</h3><p>Anyone with a page open in the last ${Math.round(ST.window / 60)} minutes</p></div></div>
    <table class="rtbl full st-tbl"><thead><tr><th>Username</th><th>Access</th><th>Topic</th><th>Page</th><th>Last seen</th></tr></thead><tbody>${who}</tbody></table></section>
  <div class="st-grid">
    <section class="panel"><div class="panel-h"><div><h3>Database</h3><p>${d.kind === "postgres" ? "Postgres numbers since the database last started" : "Local development file, not Postgres"}</p></div></div>
      ${kv("Cache hit rate", hit)}${kv("Transactions", st ? (st.commits + st.rollbacks).toLocaleString() : "—")}${kv("Rolled back", st ? st.rollbacks.toLocaleString() : "—")}${kv("Rows read", st ? st.returned.toLocaleString() : "—")}${kv("Rows written", st ? (st.inserted + st.updated).toLocaleString() : "—")}${kv("Database uptime", fmtUp(d.up))}
      <table class="rtbl full st-tbl" style="margin-top:12px"><thead><tr><th>Table</th><th>Rows</th><th>Size</th></tr></thead><tbody>${tb}</tbody></table></section>
    <section class="panel"><div class="panel-h"><div><h3>Server function</h3><p>The code answering requests${f.region ? " in " + esc(f.region) : ""}</p></div></div>
      <div class="st-bar" title="${memPct}% of the heap in use"><i style="width:${memPct}%"></i></div>
      ${kv("Memory in use", fmtB(f.rss))}${kv("JS heap", fmtB(f.heap) + " of " + fmtB(f.heapTotal))}${kv("CPU time used", f.cpuMs.toLocaleString() + " ms")}${kv("Instance uptime", fmtUp(f.up))}${kv("Runtime", esc(f.node))}
      ${f.host ? kv("This machine's memory", fmtB(f.host.total - f.host.free) + " of " + fmtB(f.host.total)) + kv("This machine's load", f.host.load.toFixed(2) + " on " + f.host.cores + " cores") : ""}</section>
  </div>
  <p class="muted" style="font-size:12.5px">The database's own CPU and RAM are not exposed to queries. The numbers above come straight from Postgres. Compute CPU and RAM for the Neon database are in the Neon console, or can be added here with a Neon API key.</p>`;
}
/* ---------- SIDES BY DAY: admin and chairs pull each character onto a side, one day at a time ---------- */
function loadSides() { return SentinelAuth.api("GET", "/api/sides").then(r => r.ok ? r.json() : null).then(j => { SD = j || SD || false; if (UI.page === "sides") render(); }, () => {}); }
function sdSend(body) {
  return SentinelAuth.api("POST", "/api/sides", body).then(r => r.ok ? r.json() : Promise.reject()).then(j => { SD[body.topic] = j; sdPick = null; render(); }, () => toast("Could not save, try again"));
}
function sdDay(t) { const days = SD[t].days; return UI.sd && days.some(x => x.n === UI.sd) ? UI.sd : days[days.length - 1].n; }
function sdMove(id, side) {
  const t = S.topic, dn = sdDay(t);
  if (SD[t].days.find(x => x.n === dn).sides[id] === side) { sdPick = null; render(); return; }
  sdSend({ topic: t, day: dn, id, side });
}
function pgSides() {
  if (SD === null) { SD = false; loadSides(); }
  if (ALLOC === null) { ALLOC = false; loadAlloc(); }
  const t = S.topic, top = `<div class="pg-head"><div><div class="eyebrow">${ROLE === "admin" ? "Administrator" : "Chair"}</div><h2 class="pg-h">Sides by day</h2><p class="pg-p">Each day, pull a character onto a side. A new day starts from the day before. Delegates see their own side change straight away.</p></div></div>`;
  if (!SD || !SD[t]) return top + `<section class="panel"><p class="muted">Loading…</p></section>`;
  const days = SD[t].days, dn = sdDay(t), day = days.find(x => x.n === dn), N = SD.names[t];
  const chars = (ALLOC && ALLOC.chars) || [], who = {};
  if (ALLOC && ALLOC.assigned) Object.keys(ALLOC.assigned).forEach(u => Object.values(ALLOC.assigned[u]).forEach(id => { who[id] = u; }));
  const list = Object.keys(day.sides).map(id => ({ id, side: day.sides[id], name: (chars.find(c => c.id === id) || {}).name || id }));
  const col = side => {
    const L = list.filter(x => x.side === side);
    return `<section class="sd-col ${side}" data-drop="${side}"><header><b>${esc(N[side])}</b><small>${plural(L.length, "character")}</small>${sdPick ? `<button class="btn sm" data-a="sdPut" data-s="${side}">Move here</button>` : ""}</header><div class="sd-list">${L.map(x => `<button class="sd-chip${sdPick === x.id ? " on" : ""}" draggable="true" data-a="sdPick" data-id="${x.id}"><span>${esc(x.name)}</span>${who[x.id] ? `<small>${esc(who[x.id])}</small>` : ""}</button>`).join("") || '<div class="col-empty">Drop a character here</div>'}</div></section>`;
  };
  return top + `<div class="pg-tools sd-bar">${ROLE === "admin" ? seg("topic", Object.values(TOPICS).map(T => [T.id, T.title]), t, "t") : ""}${seg("sdDay", days.map(d => [d.n, "Day " + d.n]), dn, "d")}<button class="btn sm" data-a="sdAdd">${ico("plus")} Add day</button>${days.length > 1 ? '<button class="btn sm danger" data-a="sdDrop">Remove last day</button>' : ""}</div>
  <div class="sd-board">${col("me")}${col("ne")}${col("foe")}</div>`;
}
const charOpts = (cur, taken, topic) => `<option value="">${esc(TOPICS[topic].title)}: no character</option>` + ALLOC.chars.filter(c => c.topic === topic).map(c => { const who = taken[c.id]; return `<option value="${c.id}" ${c.id === cur ? "selected" : ""} ${who && c.id !== cur ? "disabled" : ""}>${esc(c.name)} · ${esc(c.factionLabel)}${who && c.id !== cur ? " (" + esc(who) + ")" : ""}</option>`; }).join("");
const ACC_ERR = { username: "Username: 2 to 32 letters, numbers, dots, dashes or underscores", password: "Password must be 10 characters or more", "password-common": "That password is too easy to guess, pick another", role: "Pick an access level", self: "You cannot remove your own account", "last-admin": "The last administrator cannot be removed or lowered", origin: "Request blocked, reload the page", forbidden: "Admin access needed" };
function loadAcc() {
  return SentinelAuth.api("GET", "/api/accounts").then(r => r.ok ? r.json() : Promise.reject()).then(j => { ACC = j; accErr = ""; }, () => { ACC = ACC || []; accErr = "Could not load the accounts."; }).then(() => { if (UI.page === "control") render(); });
}
function pgControl() {
  if (ACC === null) { ACC = false; loadAcc(); }
  if (ALLOC === null) { ALLOC = false; loadAlloc(); }
  const asg = (ALLOC && ALLOC.assigned) || {}, taken = {}; Object.keys(asg).forEach(u => Object.values(asg[u]).forEach(id => { taken[id] = u; }));
  const me = SentinelAuth.user(), roleN = r => r[0].toUpperCase() + r.slice(1);
  const n = r => (ACC || []).filter(a => a.role === r).length;
  const rows = ACC === false ? `<tr><td colspan="4" class="muted">Loading accounts…</td></tr>` : (ACC.length ? [["admin", "Admin"], ["chair", "Chairs"], ["delegate", "Former delegates (cannot sign in)"]].map(([rl, gl]) => { const G = ACC.filter(a => a.role === rl); return G.length ? `<tr class="grp"><td colspan="4">${gl} · ${G.length}</td></tr>` + G.map(a => `<tr><td>${esc(a.u)}${a.u === me ? ' <span class="muted">(you)</span>' : ""}</td><td>${roleN(esc(a.role))}</td><td>${a.role === "delegate" && ALLOC ? `<div class="cp-chars">${Object.values(TOPICS).map(T => `<select class="sel" data-c="cpChar" data-u="${esc(a.u)}" data-t="${T.id}" aria-label="${esc(T.title)} character for ${esc(a.u)}">${charOpts((asg[a.u] || {})[T.id] || "", taken, T.id)}</select>`).join("")}</div>` : `<span class="muted">${a.role === "delegate" ? "…" : "—"}</span>`}</td><td style="text-align:right"><button class="btn sm" data-a="cpFill" data-u="${esc(a.u)}" data-r="${esc(a.role)}">Reset password</button> <button class="btn sm danger" data-a="cpDel" data-u="${esc(a.u)}" ${a.u === me ? "disabled" : ""}>Remove</button></td></tr>`).join("") : ""; }).join("") : `<tr><td colspan="4" class="muted">${esc(accErr || "No accounts.")}</td></tr>`);
  return `<div class="pg-head"><div><div class="eyebrow">Administrator</div><h2 class="pg-h">Control panel</h2><p class="pg-p">Accounts and access levels for the whole committee. Rules and formulas are under Rules &amp; Formulas.</p></div></div>` + `
  <section class="panel"><div class="panel-h"><div><h3>Accounts</h3><p>${ACC ? `${plural(n("chair"), "chair")} · ${plural(n("admin"), "admin")}` : "Everyone who can sign in"}</p></div></div>
    <table class="rtbl full"><thead><tr><th>Username</th><th>Access</th><th>Character</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    <div class="fgrid" style="margin-top:14px">
      <div class="fld"><label for="cp-u">Username</label><input id="cp-u" maxlength="32" autocomplete="off" spellcheck="false"></div>
      <div class="fld"><label for="cp-p">Password</label><input id="cp-p" type="password" maxlength="200" autocomplete="new-password"></div>
      <div class="fld"><label for="cp-r">Access</label><select id="cp-r"><option value="chair">Chair</option><option value="admin">Admin</option></select></div>
      <div class="fld" style="align-self:end"><button class="btn primary" data-a="cpAdd">Save account</button></div>
    </div>
    <p class="muted" style="font-size:12.5px">Saving an existing username resets its password and access level.</p></section>
` + `
  <section class="panel"><div class="panel-h"><div><h3>Reset for everyone</h3><p>Wipes the troops on the map, the chairs' forces, battle lines, city sides and sides by day. Accounts and characters stay. Every browser clears its own forces the next time it loads.</p></div></div>
    <div class="data-btns"><button class="btn danger" data-a="cpReset" data-s="t1">Reset ${esc(TOPICS.t1.title)}</button><button class="btn danger" data-a="cpReset" data-s="t2">Reset ${esc(TOPICS.t2.title)}</button><button class="btn danger" data-a="cpReset" data-s="all">Reset everything</button></div></section>` + accessPanel();
}

/* Put a freshly built page in place by changing only what differs from what is on screen. Rebuilding the whole page on every refresh
   (the map and the shared lists reload every 10 to 15 seconds) re-created every image and chart, which made the screen flash and lag.
   Nodes that are equal stay as they are (with their focus, scroll and loaded images); form fields that differ are replaced outright. */
const MORPH_SWAP = /^(INPUT|SELECT|TEXTAREA|OPTION|IMG|image|CANVAS|VIDEO|IFRAME)$/;
const isMap = n => n.nodeType === 1 && n.classList.contains("mapsvg");
/* two nodes that may stand for each other: equal, or the live map and its new build (the live one is kept and brought up to date) */
const domSame = (p, q) => p.isEqualNode(q) || (isMap(p) && isMap(q) && p.dataset.t === q.dataset.t);
function domMorphKids(a, b) {
  const A = [...a.childNodes], B = [...b.childNodes];
  if (A.length !== B.length) {
    /* lists that grew or shrank: keep the leading and trailing nodes that are still the same, replace the middle */
    const nA = A.length, nB = B.length; let i = 0, j = 0;
    while (i < nA && i < nB && domSame(A[i], B[i])) i++;
    while (j < nA - i && j < nB - i && domSame(A[nA - 1 - j], B[nB - 1 - j])) j++;
    for (let k = 0; k < i; k++) domMorph(A[k], B[k]);
    for (let k = 0; k < j; k++) domMorph(A[nA - 1 - k], B[nB - 1 - k]);
    const ref = A[nA - j] || null; for (let k = nA - j - 1; k >= i; k--) a.removeChild(A[k]);
    for (let k = i; k < nB - j; k++) a.insertBefore(B[k], ref);
    return;
  }
  for (let k = 0; k < B.length; k++) domMorph(A[k], B[k]);
}
function domMorph(x, y) {
  if (x.isEqualNode(y)) return;
  if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { x.replaceWith(y); return; }
  if (x.nodeType === 3 || x.nodeType === 8) { x.nodeValue = y.nodeValue; return; }
  if (x.nodeType !== 1) { x.replaceWith(y); return; }
  if (x.classList.contains("mapsvg")) { if (x.dataset.t === y.dataset.t && typeof mpSyncSvg === "function") mpSyncSvg(x, y); else x.replaceWith(y); return; }
  if (MORPH_SWAP.test(x.nodeName) || x.hasAttribute("data-chart") || x.id === "page") { x.replaceWith(y); return; }
  for (const at of [...x.attributes]) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
  for (const at of [...y.attributes]) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
  domMorphKids(x, y);
}
function pagePut(html) {
  const host = $("page"), tpl = document.createElement("template"); tpl.innerHTML = html;
  if (!host.firstChild) { host.replaceChildren(tpl.content); return; }
  domMorphKids(host, tpl.content);
  const svg = host.querySelector(".mapsvg");
  if (svg && svg.dataset.base !== "1" && typeof mpBase === "function") { svg.insertAdjacentHTML("afterbegin", mpBase(svg.dataset.t)); svg.dataset.base = "1"; }   /* never leave a map without its land and sea */
  if (svg && typeof mpLabels === "function") mpLabels(svg);
}
let renderWait = false;
function render() {
  if (dragging()) {   /* never redraw under a card being dragged; catch up as soon as it is dropped */
    if (!renderWait) { renderWait = true; (function w() { if (dragging()) requestAnimationFrame(w); else { renderWait = false; render(); } })(); }
    return;
  }
  if (UI.page === "roster") UI.page = "forces";   /* Battle Overview was folded into My Forces */
  if (!pages().some(p => p.id === UI.page)) UI.page = pages()[0].id;
  const a = document.activeElement, fid = a && a.id ? a.id : null; let ss = null;
  try { if (fid && typeof a.selectionStart === "number") ss = [a.selectionStart, a.selectionEnd]; } catch (e) { /* not a text field */ }
  const keep = {}; document.querySelectorAll("[data-keep]").forEach(el => { keep[el.dataset.keep] = [el.scrollLeft, el.scrollTop]; });
  chrome();
  const P = { map: pgMap, status: pgStatus, control: pgControl, sides: pgSides, overview: pgOverview, forces: pgForces, board: pgBoard, roster: pgRoster, combat: pgCombat, rules: pgRules, morale: pgMorale, settings: pgSettings }[UI.page] || pgOverview;
  const pg = UI.page + "|" + S.topic; if ($("page").dataset.pg !== pg) { $("page").replaceChildren(); $("page").dataset.pg = pg; }   /* a new page starts clean */
  const cf = viewCab(); VIEW = cf && VIEW_PAGES.includes(UI.page) ? mkView(cf) : null;
  let html; try { html = P(); } finally { VIEW = null; }
  pagePut(html);
  lockPage();
  if (DEL && MINE && MINE[S.topic] && MINE[S.topic].side === "ne") $("page").insertAdjacentHTML("afterbegin", `<div class="lockbar" role="note"><b>Neutral today.</b> You have no force on Day ${MINE[S.topic].day}. The chairs decide when you join a side.</div>`);
  renderDrawer();
  document.querySelectorAll("[data-keep]").forEach(el => { const k = keep[el.dataset.keep]; if (k) { el.scrollLeft = k[0]; el.scrollTop = k[1]; } });
  CH.bind($("page"));
  if (fid) { const e = $(fid); if (e && e !== document.activeElement) { e.focus({ preventScroll: true }); if (ss && e.setSelectionRange) try { e.setSelectionRange(ss[0], ss[1]); } catch (x) { /* ignore */ } } }
  renderSave();
  if (ROLE !== "admin" && typeof mpTroopsLoad === "function") { if (!mpTLoaded) mpTroopsLoad(); else mpTroopSync(); if (ROLE === "chair") mpForcesPush(); if (typeof mpPointsLoad === "function" && Date.now() - mpPtAt > 15000) mpPointsLoad(); }   /* the chairs' units and the troops on the map stay one thing */
}
/* the top bar names the account that is signed in: its role, then its username when that adds something */
function acctLbl() {
  const role = { admin: "Administrator", chair: "Chair", delegate: "Delegate" }[ROLE] || "Delegate", u = String((window.SentinelAuth && SentinelAuth.user()) || "");
  return u && u.toLowerCase() !== role.toLowerCase() && u.toLowerCase() !== ROLE ? `${role} · ${u}` : role;
}
function chrome() {
  const d = D(), P = pages().find(p => p.id === UI.page) || pages()[0], sl = selNow();
  { const ad = ROLE === "admin", ab = document.querySelector(".top-actions [data-a=addUnits]"); if (ab) ab.style.display = ad ? "none" : ""; $("undoBtn").style.display = ad ? "none" : ""; $("sideFoot").style.display = ad ? "none" : ""; }
  { const adm = ROLE === "admin", lbl = document.querySelector(".side-lbl"); $("topics").hidden = true; if (lbl) lbl.hidden = true; $("chgTopic").hidden = false; $("chgTopic").textContent = adm ? "Topic maps" : "Change topic"; }
  $("topics").innerHTML = Object.values(TOPICS).map(T => `<button class="topic ${S.topic === T.id ? "on" : ""}" data-a="topic" data-t="${T.id}" aria-pressed="${S.topic === T.id}"><span class="eyebrow">Topic ${T.num}</span><b>${esc(T.title)}</b><small>${T.year}</small></button>`).join("");
  const ct = { forces: d.units.filter(u => u.side === "me" && !lost(u)).length, combat: sl.A.length + sl.D.length };
  $("nav").innerHTML = pages().map(p => `<button class="nav-i ${p.id === UI.page ? "on" : ""}" data-a="go" data-p="${p.id}" ${p.id === UI.page ? 'aria-current="page"' : ""}>${ico(p.icon)}<span>${p.name}</span>${ct[p.id] ? `<span class="ct">${ct[p.id]}</span>` : ""}</button>`).join("");
  if (ROLE === "chair") $("footNote").innerHTML = "SENTINEL Joint Operations Center &middot; Historical Joint Crisis Committee simulation. The chairs command every force and set morale and every outcome. Your units, the map, morale, sides and rules are shared with the other chairs.";
  $("sideFoot").innerHTML = `${DEL ? `<div class="eyebrow">Allocation</div><div><b>${d.alloc.delegation ? esc(d.alloc.delegation) : "Pending"}</b>${d.alloc.portfolio ? ` · ${esc(d.alloc.portfolio)}` : ""}</div>` : ""}${DEL ? "" : `<div>${esc(sideLbl("me"))} <span class="muted">v</span> ${esc(sideLbl("foe"))}</div>`}<div class="sf-n">${DEL ? "Your own running figures. The chairs decide every outcome." : "The chairs command every force and set morale and every outcome."}</div>`;
  $("pageTitle").textContent = P.name; $("pageSub").textContent = acctLbl();
  $("undoBtn").disabled = !UNDO.length;
  const th = themeNow(); $("dayBtn").classList.toggle("on", th === "light"); $("nightBtn").classList.toggle("on", th === "dark");
  $("dayBtn").setAttribute("aria-pressed", th === "light"); $("nightBtn").setAttribute("aria-pressed", th === "dark");
  document.title = `${P.name} · SENTINEL`;
}
function renderSave() {
  const e = $("saveState"); if (!e) return;
  e.classList.toggle("err", saveErr);
  e.textContent = saveErr ? "Not saved: browser storage is blocked or full. Export a backup." : lastSaved ? `Saved on this device · ${hhmm(lastSaved)}` : "Saved on this device";
}
const head = (title, p, tools = "") => `<div class="pg-head"><div><div class="eyebrow">${esc(topicLbl())}</div><h2 class="pg-h">${title}</h2>${p ? `<p class="pg-p">${p}</p>` : ""}</div>${tools ? `<div class="pg-tools">${tools}</div>` : ""}</div>`;
/* collapsible panels: UI.fold[key] is true while a panel is collapsed (remembered on this device).
   A collapsed panel keeps its header, and its subtitle switches to a one-line summary (fsub) so it can still be skimmed. */
const attr = x => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const isFold = k => !!UI.fold[k];
const foldCls = k => isFold(k) ? " folded" : "";
const ph = (k, title, sub, tools = "", fsub) => { const f = isFold(k); return `<div class="panel-h fold-h"><button class="fold-t" id="fold-${k}" data-a="fold" data-k="${k}" aria-expanded="${!f}" title="${f ? "Expand" : "Collapse"}"><span class="chev">${ico("chev")}</span><span><h3>${title}</h3>${(f && fsub) || sub ? `<p${fsub ? ` data-sub="${attr(sub)}" data-fsub="${attr(fsub)}"` : ""}>${f && fsub ? fsub : sub}</p>` : ""}</span></button>${tools ? `<div class="ph-tools">${tools}</div>` : ""}</div>`; };
const foldAll = keys => `<button class="btn sm" data-a="foldAll" data-k="${keys.join(",")}" data-v="1">Collapse all</button><button class="btn sm" data-a="foldAll" data-k="${keys.join(",")}" data-v="0">Expand all</button>`;
function emptyState() {
  return `<div class="panel empty"><div class="eyebrow">${esc(topicLbl())}</div><h2>No forces recorded yet</h2>
    <p>Load every country from the booklets in one click, pick countries, or add units by hand.</p>
    <div class="row-btns">${bookletBtn()}<button class="btn ${bookletFor() ? "" : "primary "}lg" data-a="addUnits">${ico("plus")} Add units</button><button class="btn lg" data-a="sample">Load sample forces (demo)</button></div></div>`;
}

/* ---------- MORALE: the chairs set it, delegates only see their own side's ----------
   The figure lives on the server (api/morale.js); every device copies it into its own sides[].morale so the charts and the combat calculator keep using it. */
const MORALE_NA = {};   /* topic -> true while a delegate is on no side, so there is no morale to show */
let moraleBusy = 0;
const showMorale = () => D().rules.useMorale && !(DEL && MORALE_NA[S.topic]);
function setMorale(s, raw) {
  if (ROLE !== "chair") { deny(); render(); return; }
  if (typeof raw === "string" && !raw.trim()) { render(); return; }   /* an emptied field is not 0%: keep the figure */
  const d = D(), v = clamp(r2(num(raw, 50)), 0, 100), o = d.sides[s].morale; if (v === o) { render(); return; }
  d.sides[s].morale = v; addLog(d, `Morale (${sideLbl(s)}): ${fx(o)}% → ${fx(v)}%`, "rules"); save(); render();
  moraleBusy++;
  SentinelAuth.api("POST", "/api/morale", { topic: S.topic, side: s, value: v }).then(r => { if (!r.ok) throw 0; }).catch(() => { toast("Could not save the morale, try again"); }).then(() => { moraleBusy--; loadMorale(); });
}
function setCabMorale(c, raw) {
  if (ROLE !== "chair") { deny(); render(); return; }
  if (!cabById(c) || (typeof raw === "string" && !raw.trim())) { render(); return; }
  const d = D(), v = clamp(r2(num(raw, 50)), 0, 100), o = cabMorale(c); if (v === o) { render(); return; }
  d.cabMorale = Object.assign({}, d.cabMorale, { [c]: v }); addLog(d, `Morale (${cabName(c)}): ${fx(o)}% → ${fx(v)}%`, "rules"); save(); render();
  moraleBusy++;
  SentinelAuth.api("POST", "/api/morale", { topic: S.topic, cab: c, value: v }).then(r => { if (!r.ok) throw 0; }).catch(() => { toast("Could not save the morale, try again"); }).then(() => { moraleBusy--; loadMorale(); });
}
/* ---------- shared rules ----------
   The rules of each topic (formula, switches, tables, directives) live on the server (api/rules.js) so the Admin's and the chairs' edits reach every calculator.
   Every device keeps its copy in S as before and the pages read that. RSYNC is the copy as the server last had it; when S differs, an Admin or chair device sends it.
   A save carries the version it was based on, so a device that slept through someone else's change gets the new rules back instead of putting old ones in their place. */
const RVER = { t1: null, t2: null }, RSYNC = {}, RTOPICS = ["t1", "t2"]; let rulesOk = false, rulesT = 0, rulesBusy = false, rulesFail = false;
const rulesJson = t => JSON.stringify(S.topics[t].rules);
function rulesAdopt(t, rules) {
  const d = S.topics[t], next = Object.assign(defaultRules(), rules);
  if (next.trenchKm === 30 && !next.trenchKm10) { next.trenchKm = 10; next.trenchKm10 = true; }   /* 30 km was the first default and let units far from a trench count as in it: every device reads it as 10 (the next rules save stores that) */
  const ch = JSON.stringify(next) !== JSON.stringify(d.rules);
  d.rules = next; RSYNC[t] = rulesJson(t);
  /* Undo puts a whole earlier state back. Without this, undoing an HP change made before the new rules arrived would bring the old rules back with it, and send them. */
  if (ch) for (let i = 0; i < UNDO.length; i++) { try { const o = JSON.parse(UNDO[i]); if (o.topics && o.topics[t]) { o.topics[t].rules = next; UNDO[i] = JSON.stringify(o); } } catch (e) { /* leave that step as it is */ } }
  return ch;
}
function loadRules() {
  if (rulesBusy || rulesT) return Promise.resolve();   /* a save is on its way: its answer brings the rules */
  return SentinelAuth.api("GET", "/api/rules").then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !j.ver || rulesBusy || rulesT) return;
    if (rulesOk && UI.page === "rules" && document.querySelector("#page :focus")) return;   /* someone is typing in a rule: do not change the page under them, the next look picks it up */
    const first = !rulesOk; let ch = false;
    RTOPICS.forEach(t => {
      if (!S.topics[t] || (!first && RSYNC[t] !== rulesJson(t))) return;   /* an edit made here has not been sent yet */
      if (j[t]) { if (first || RVER[t] !== j.ver[t]) ch = rulesAdopt(t, j[t]) || ch; }
      /* Nobody has saved rules for this topic yet. Until now the chairs' own rules were the ones every battle used, so a chair's device hands its rules in
         (if it changed any); everyone else waits for the first edit. */
      else if (first) RSYNC[t] = ROLE === "chair" && rulesJson(t) !== JSON.stringify(defaultRules()) ? "" : rulesJson(t);
      RVER[t] = j.ver[t];
    });
    rulesOk = true;
    if (ch) { save(); if (!dragging() && !document.querySelector("#page :focus")) render(); } else rulesPush();
  }, () => {});
}
function rulesPush() {
  if (!rulesOk || (ROLE !== "admin" && ROLE !== "chair") || !RTOPICS.some(t => S.topics[t] && RSYNC[t] !== rulesJson(t))) return;
  clearTimeout(rulesT); rulesT = setTimeout(rulesFlush, 500);
}
async function rulesFlush() {
  rulesT = 0; if (rulesBusy) { rulesT = setTimeout(rulesFlush, 300); return; }
  rulesBusy = true; let took = false, tidy = false;
  try {
    for (const t of RTOPICS) {
      for (let n = 0; S.topics[t] && RSYNC[t] !== rulesJson(t); n++) {
        const sent = rulesJson(t), r = await SentinelAuth.api("POST", "/api/rules", { topic: t, rules: S.topics[t].rules, base: RVER[t] || "0" }), j = await r.json().catch(() => null);
        if (r.ok && j && j.ver) { RVER[t] = j.ver; if (rulesJson(t) === sent) { rulesAdopt(t, j.rules); tidy = true; } else RSYNC[t] = sent; rulesFail = false; continue; }   /* edited again while it was on its way: goes round once more */
        if (r.status === 409 && j && j.error === "stale") { RVER[t] = j.ver; if (j.rules) { rulesAdopt(t, j.rules); took = true; break; } if (n < 2) continue; }
        throw new Error("rules");
      }
    }
  } catch (e) { if (!rulesFail) toast("Could not save the rules. They are kept on this device and will be sent again"); rulesFail = true; }
  rulesBusy = false;
  if (took) { save(); render(); toast("The rules were changed on another screen just now. Yours were not saved: check them and make your change again"); }
  else if (tidy) save();
}
function loadMorale() {
  if (ROLE === "admin") return Promise.resolve();
  return SentinelAuth.api("GET", "/api/morale").then(r => r.ok ? r.json() : null).then(j => {
    if (!j || moraleBusy) return; let ch = false;
    ["t1", "t2"].forEach(t => {
      const d = S.topics[t]; if (!d) return;
      if (DEL) { const v = j.mine && j.mine[t], na = v == null; if (!!MORALE_NA[t] !== na) { MORALE_NA[t] = na; ch = true; } if (!na && d.sides.me.morale !== v) { d.sides.me.morale = v; ch = true; } }
      else {
        ["me", "foe"].forEach(s => { const v = j[t] && j[t][s]; if (Number.isFinite(v) && d.sides[s].morale !== v) { d.sides[s].morale = v; ch = true; } });
        const cm = (j[t] && j[t].cab) || {}; if (JSON.stringify(cm) !== JSON.stringify(d.cabMorale || {})) { d.cabMorale = cm; ch = true; }
      }
    });
    if (ch) { save(); if (!dragging() && !document.querySelector("#page :focus")) render(); }
  }, () => {});
}
function pgMorale() {
  const d = D(), card = s => { const m = d.sides[s].morale, T = tot(s); return `<div class="panel">
    <div class="panel-h"><div><h3><span class="sd ${s}"></span>${esc(sideLbl(s))}</h3><p>${plural(T.n, "unit")} in the field · delegates on this side see this figure</p></div></div>
    <div class="stat-big">${fx(m)}<small>%</small></div><div class="stat-lbl">Morale of ${esc(sideLbl(s))}</div>
    <div class="fld" style="margin-top:18px"><label for="mo-${s}">Set morale</label><div class="rng"><input type="range" min="0" max="100" step="1" value="${m}" id="mo-${s}r" data-i="pair" data-pair="mo-${s}" data-c="morale" data-s="${s}" aria-label="Morale of ${esc(sideLbl(s))}"><input type="number" min="0" max="100" step="1" value="${fx(m)}" id="mo-${s}" data-i="pair" data-pair="mo-${s}r" data-c="morale" data-s="${s}"></div></div>
    <div class="row-btns">${[-10, -5, 5, 10].map(n => `<button class="btn sm" data-a="moraleStep" data-s="${s}" data-d="${n}">${n > 0 ? "+" : "−"}${Math.abs(n)}</button>`).join("")}</div></div>`; };
  if (hasCabs()) return pgMoraleCab(d, card);
  return head("Morale", "Set the morale of each side. Delegates can only see their own side's figure, and the combat calculator uses it for the attacker.") +
    (d.rules.useMorale ? "" : '<div class="note">Morale is switched off in Rules &amp; formulas, so it is not part of the damage for now.</div>') +
    `<section class="set-grid">${card("me")}${card("foe")}</section>`;
}

/* the side a country is on now: the side most of its units are on, else the side it starts on */
function cabSide(c, d = D()) {
  const n = { me: 0, foe: 0, ne: 0 }; d.units.forEach(u => { if (u.cab === c && !lost(u) && n[u.side] != null) n[u.side]++; });
  const best = Object.keys(n).sort((a, b) => n[b] - n[a])[0]; return n[best] ? best : ((cabById(c) || {}).side || "ne");
}
/* ---------- the country switch (Overview, Forces, Order of Battle) ---------- */
const VIEW_PAGES = ["overview", "forces", "board"];
const viewCab = () => hasCabs() && (UI.cabF === "_" || cabById(UI.cabF)) ? UI.cabF : "";
function mkView(cf) {
  const d = S.topics[S.topic], inC = u => cf === "_" ? !cabById(u.cab) : u.cab === cf, units = d.units.filter(inC), ids = new Set(units.map(u => u.id));
  const hist = cf === "_" ? [] : d.hist.filter(h => h.cab && h.cab[cf]).map(h => ({ t: h.t, me: h.cab[cf], foe: h.cab[cf] }));
  return { src: d, cab: cf, d: Object.assign({}, d, { units, hist, battles: d.battles.filter(b => b.att.some(x => ids.has(x.id)) || b.def.some(x => ids.has(x.id))) }) };
}
function cabBar() {
  if (!hasCabs()) return ""; const d = S.topics[S.topic], cf = viewCab(), n = f => d.units.filter(u => f(u) && !lost(u)).length, none = n(u => !cabById(u.cab));
  const chip = (id, label, color, k) => `<button class="cb-chip${cf === id ? " on" : ""}" data-a="cabPick" data-c="${id}" aria-pressed="${cf === id}">${color ? `<i style="background:${esc(color)}"></i>` : ""}<b>${esc(label)}</b><small>${k}</small></button>`;
  return `<nav class="cab-bar" aria-label="Show one country">${chip("", "All countries", "", n(() => true))}${CABS().map(c => chip(c.id, c.name, c.color, n(u => u.cab === c.id))).join("")}${none ? chip("_", "No country", "#6b7380", none) : ""}</nav>`;
}
/* Topic 2: one morale per country. The calculator fights each group with the HP-weighted morale of its countries. */
function pgMoraleCab(d, sideCard) {
  const cc = c => { const m = cabMorale(c.id), U = d.units.filter(u => u.cab === c.id), A = U.filter(u => !lost(u)), id = "mo-c-" + c.id; return `<div class="panel mo-c" style="--cc:${esc(c.color)}">
    <div class="mo-c-h"><i class="cab-dot" style="background:${esc(c.color)}"></i><b>${esc(c.name)}</b><span>${A.length} of ${U.length} units</span></div>
    <div class="mo-c-v">${fx(m)}<small>%</small></div>
    <div class="rng"><input type="range" min="0" max="100" step="1" value="${m}" id="${id}r" data-i="pair" data-pair="${id}" data-c="morale" data-cab="${c.id}" aria-label="Morale of ${esc(c.name)}"><input type="number" min="0" max="100" step="1" value="${fx(m)}" id="${id}" data-i="pair" data-pair="${id}r" data-c="morale" data-cab="${c.id}" aria-label="Morale of ${esc(c.name)} in %"></div>
    <div class="row-btns">${[-10, -5, 5, 10].map(n => `<button class="btn sm" data-a="moraleStep" data-c="${c.id}" data-d="${n}">${n > 0 ? "+" : "−"}${Math.abs(n)}</button>`).join("")}</div></div>`; };
  const groups = ["me", "foe", "ne"].map(sd => { const cs = CABS().filter(c => cabSide(c.id, d) === sd); return cs.length ? `<section class="mo-g"><h3 class="mo-gh"><span class="sd ${sd}"></span>${esc(sideLbl(sd))}<small>${plural(cs.length, "country", "countries")}</small></h3><div class="mo-grid">${cs.map(cc).join("")}</div></section>` : ""; }).join("");
  const loose = ["me", "foe"].filter(sd => d.units.some(u => u.side === sd && !cabById(u.cab)));
  return head("Morale", "Each country has its own morale. In the combat calculator a group of units fights with the morale of its countries (weighted by HP); units with no country use their side's figure below.") +
    (d.rules.useMorale ? "" : '<div class="note">Morale is switched off in Rules &amp; formulas, so it is not part of the damage for now.</div>') + groups +
    (loose.length ? `<section class="mo-g"><h3 class="mo-gh">Units with no country<small>side morale</small></h3><section class="set-grid">${loose.map(sideCard).join("")}</section></section>` : "");
}

/* ---------- OVERVIEW: charts and graphs of the forces ---------- */
function pgOverview() {
  const d = D();
  if (!d.units.length) return head("Forces overview", "") + cabBar() + (viewCab() ? '<div class="panel"><div class="none">No units for this country yet.</div></div>' : emptyState());
  const s = DEL ? "me" : UI.ovSide, T = tot(s), H = d.hist, M = UI.ovMetric, U = d.units.filter(u => u.side === s), strP = Math.round(pc(T.hp, T.max));
  const vc = VIEW && cabById(VIEW.cab), mo = hasCabs() ? groupMorale(U.filter(u => !lost(u)), s) : d.sides[s].morale;
  const series = vc ? [{ name: vc.name, col: vc.color, v: H.map(h => h[s][M]) }] : [{ name: sideLbl("me"), col: "var(--me)", v: H.map(h => h.me[M]) }].concat(DEL ? [] : [{ name: sideLbl("foe"), col: "var(--foe)", v: H.map(h => h.foe[M]) }]);
  const brs = d.branches.map(b => ({ b, n: U.filter(u => u.branch === b.id && !lost(u)).length })).filter(x => x.n > 0);
  const last = k => H.slice(-40).map(h => h[s][k]);
  /* change since the first recorded point, S&P-index style: ▲ green when it went the good way */
  const f0 = H.length ? H[0][s] : null;
  const dl = (now, was, goodUp = true) => { if (was == null) return ""; const v = r2(now - was); if (!v) return '<span class="dlt" title="Since tracking started">no change</span>'; const up = v > 0; return `<span class="dlt ${up === goodUp ? "up" : "dn"}" title="Since tracking started">${up ? "▲" : "▼"} ${fx(Math.abs(v))}</span>`; };
  const tiles = [
    ["var(--accent)", "Units in the field", T.n, `${T.all} raised · ${T.reserve} in reserve`, last("n"), dl(T.n, f0 && f0.n)],
    ["var(--good)", "Hit points", fx(T.hp), `of ${fx(T.max)} · ${strP}% strength`, last("hp"), dl(T.hp, f0 && f0.hp)],
    ["var(--gold)", "Attack power", fx(T.atk), `effective · ${fx(T.atkField)} on the fronts`, last("atk"), dl(T.atk, f0 && f0.atk)],
    ["var(--bad)", "Losses", T.lost, `${plural(T.lost, "unit")} destroyed · ${fx(T.max - T.hp)} HP lost`, H.slice(-40).map(h => h[s].max - h[s].hp), ""]
  ].map(([c, l, v, sub, sp, d]) => `<div class="tile" style="--tc:${c}"><div class="t-top"><span class="l">${l}</span>${d}</div><div class="v">${v}</div><div class="s">${sub}</div>${CH.spark(sp)}</div>`).join("");
  /* one-line summaries shown in the header while a panel is collapsed */
  const G = groupTypes(U), rdy = countBy(U, tierOf), contested = balanceRows().filter(r => r.me.length && r.fo.length).length;
  const sumTypes = `${plural(G.length, "sub class", "sub classes")} · ${G.map(g => `${esc(g.name)} ${g.nA}`).slice(0, 4).join(" · ")}${G.length > 4 ? " …" : ""}`;
  const sumReady = `${rdy.full || 0} at full strength · ${(rdy.weak || 0) + (rdy.crit || 0)} below 50% · ${rdy.lost || 0} destroyed`;
  const lastLog = d.log[0] ? `${ago(d.log[0].t)}: ${esc(d.log[0].m)}` : "Nothing recorded yet";
  const lastBattle = d.battles[0] ? `${plural(d.battles.length, "battle")} · last at ${hhmm(d.battles[0].t)}: ${esc(d.battles[0].att[0].name)} v ${esc(d.battles[0].def[0].name)}, ${fx(d.battles[0].dmg)} damage` : "No battles applied yet";
  const OVK = ["ov-trend", "ov-donut", "ov-types", "ov-ready", "ov-act", "ov-front", "ov-battles"];
  return head("Forces overview", "", (DEL ? "" : seg("ovSide", [["me", `${sideLbl("me")} · ${plural(tot("me").n, "unit")}`], ["foe", `${sideLbl("foe")} · ${plural(tot("foe").n, "unit")}`]].concat(hasCabs() ? [["ne", `Neutral · ${plural(tot("ne").n, "unit")}`]] : []), s, "s")) + foldAll(OVK)) + cabBar() + `
  <section class="ov-top">
    <div class="panel${foldCls("ov-trend")}">
      ${ph("ov-trend", "Force strength over time", "Every move, HP change and battle adds a point", seg("ovMetric", [["hp", "Hit points"], ["n", "Units"], ["atk", "Attack"]], M, "m"), `${strP}% combat strength · ${T.n} units in the field · ${T.lost} lost${showMorale() ? ` · morale ${fx(Math.round(mo))}%` : ""}`)}
      <div class="fold-body ov-trend">
        <div class="ov-l">
          <div class="stat-big">${strP}<small>%</small></div><div class="stat-lbl">Combat strength of ${esc(vc ? vc.name : sideLbl(s))} · ${fx(T.hp)} of ${fx(T.max)} HP</div>
          <div class="stat-big">${T.n}</div><div class="stat-lbl">Units in the field · ${T.lost} lost</div>
          ${showMorale() ? `<div class="stat-big sm">${fx(Math.round(mo))}<small>%</small></div><div class="stat-lbl">Morale${vc ? " of " + esc(vc.name) : hasCabs() ? " (its countries, by HP)" : ""}</div>` : ""}
          <button class="btn primary" data-a="go" data-p="forces">${ico("layers")} ${ROLE === "chair" ? "Forces" : "My forces"}</button>
        </div>
        <div class="ov-r">
          ${CH.area(series, H.map(h => h.t), { label: "Force strength over time", empty: "The chart fills in as your forces change.<br>Every move, HP change and battle adds a point." })}
          <div class="legend">${series.map(x => `<span><i style="background:${x.col}"></i>${esc(x.name)}</span>`).join("")}</div>
        </div>
      </div>
    </div>
    <div class="panel${foldCls("ov-donut")}">
      ${ph("ov-donut", "Forces by class", `${esc(vc ? vc.name : sideLbl(s))} units still in the field`, "", brs.map(x => `${esc(x.b.name)} ${x.n}`).join(" · ") || "No units in the field")}
      <div class="fold-body">
        <div class="donut-box">${CH.donut(brs.map(x => ({ v: x.n, c: x.b.color, t: x.b.name })), String(T.n), "UNITS", { label: "Units by class" })}</div>
        <div class="donut-leg">${brs.map(x => `<div><b>${Math.round(x.n / Math.max(1, T.n) * 100)}%</b><span><i style="background:${x.b.color}"></i>${esc(x.b.name)} · ${x.n}</span></div>`).join("") || '<div class="none">No units in the field.</div>'}</div>
      </div>
    </div>
  </section>
  <section class="tiles">${tiles}</section>
  <section class="ov-mid">
    <div class="panel${foldCls("ov-types")}">${ph("ov-types", "Units by sub class", "How many are left in the field, and how many were lost", '<button class="lnk" data-a="go" data-p="forces">Details</button>', sumTypes)}<div class="fold-body">${typeBars(s)}</div></div>
    <div class="panel${foldCls("ov-ready")}">${ph("ov-ready", "Readiness", "Units by strength (HP left as a share of full HP)", "", sumReady)}<div class="fold-body">${readiness(s)}</div></div>
  </section>
  <section class="ov-bot">
    <div class="panel${foldCls("ov-act")}">${ph("ov-act", "Recent activity", "", '', lastLog)}<div class="fold-body">${activity(8)}</div></div>
    ${DEL ? "" : `<div class="panel${foldCls("ov-front")}">${ph("ov-front", "Force balance by class", `Hit points in the field: ${esc(sideLbl("me"))} against ${esc(sideLbl("foe"))}`, "", `${plural(contested, "class", "classes")} facing each other`)}<div class="fold-body">${balance()}</div></div>`}
  </section>
  ${DEL ? "" : `<section class="panel${foldCls("ov-battles")}">${ph("ov-battles", "Battle record", "Engagements applied from the combat calculator", '<button class="lnk" data-a="go" data-p="combat">Combat calculator</button>', lastBattle)}<div class="fold-body">${battleTable(8)}</div></section>`}`;
}
function groupTypes(U) {
  const d = D(), m = new Map();
  U.forEach(u => {
    const t = d.types.find(x => x.id === u.type), k = t ? t.id : "c:" + (u.tname || "Custom unit");
    if (!m.has(k)) m.set(k, { k, code: t ? t.code : (u.tcode || "—"), name: t ? t.name : (u.tname || "Custom unit"), branch: t ? t.branch : u.branch, units: [] });
    m.get(k).units.push(u);
  });
  const bo = id => { const i = d.branches.findIndex(b => b.id === id); return i < 0 ? 99 : i; };
  return [...m.values()].map(g => { const al = g.units.filter(u => !lost(u)); return { ...g, alive: al, nA: al.length, nL: g.units.length - al.length, hp: r2(sum(al.map(u => u.hp))), max: r2(sum(al.map(u => u.maxhp))), atk: r2(sum(al.map(u => eff(u).eff))) }; })
    .sort((a, b) => bo(a.branch) - bo(b.branch) || a.name.localeCompare(b.name));
}
function typeBars(s) {
  const G = groupTypes(D().units.filter(u => u.side === s)); if (!G.length) return '<div class="none">No units yet.</div>';
  const mx = Math.max(1, ...G.map(g => g.units.length));
  return G.map(g => { const c = branchById(g.branch).color; return `<div class="tb"><div class="tb-l"><span class="code" style="--bc:${c}">${esc(g.code)}</span><span class="nm">${esc(g.name)}</span></div><div class="tb-bar" title="${g.nA} left, ${g.nL} lost"><i style="width:${g.nA / mx * 100}%;background:${c}"></i><i class="lost" style="width:${g.nL / mx * 100}%"></i></div><div class="tb-v"><b>${g.nA}</b> left${g.nL ? ` · ${g.nL} lost` : ""}</div></div>`; }).join("");
}
function readiness(s) {
  const U = D().units.filter(u => u.side === s), c = { full: 0, good: 0, fair: 0, weak: 0, crit: 0, lost: 0 };
  U.forEach(u => c[tierOf(u)]++); const mx = Math.max(1, ...Object.values(c));
  return `<div class="rd">${Object.keys(c).map(k => `<div class="rd-c"><div class="rd-v">${c[k]}</div><div class="rd-bar"><i class="t-${k}" style="height:${c[k] / mx * 100}%"></i></div><div class="rd-l">${TIER_L[k]}</div></div>`).join("")}</div>`;
}
/* one front, so the balance is compared class by class (units in the field, reserve included) */
function balanceRows() {
  const d = D();
  return d.branches.map(c => {
    const me = d.units.filter(u => u.side === "me" && u.branch === c.id && !lost(u)), fo = d.units.filter(u => u.side === "foe" && u.branch === c.id && !lost(u));
    return { c, me, fo, a: r2(sum(me.map(u => u.hp))), b: r2(sum(fo.map(u => u.hp))) };
  }).filter(r => r.me.length || r.fo.length);
}
function balance() {
  const rows = balanceRows();
  if (!rows.length) return '<div class="none">No units in the field yet.</div>';
  return rows.map(r => {
    const t = r.a + r.b || 1, ra = r.a > 0 && r.b > 0 ? (r.a >= r.b ? `${fx(r.a / r.b)} : 1` : `1 : ${fx(r.b / r.a)}`) : r.a > 0 ? (ROLE === "chair" ? "no " + sideLbl("foe") : "no enemy") : (ROLE === "chair" ? sideLbl("foe") + " only" : "enemy only");
    return `<div class="fb"><div class="fb-n"><b><i class="bsq" style="--bc:${r.c.color}"></i>${esc(r.c.name)}</b><small>${r.me.length} v ${r.fo.length} units</small></div><div class="fb-bar" title="${esc(sideLbl("me"))} ${fx(r.a)} HP, ${esc(sideLbl("foe"))} ${fx(r.b)} HP">${r.a ? `<i class="me" style="width:${r.a / t * 100}%">${fx(r.a)}</i>` : ""}${r.b ? `<i class="foe" style="width:${r.b / t * 100}%">${fx(r.b)}</i>` : ""}</div><div class="fb-r">${ra}</div></div>`;
  }).join("");
}
const KIND = { add: ["plus", "k-blue"], move: ["move", "k-navy"], battle: ["swords", "k-red"], hp: ["pulse", "k-amber"], rules: ["sliders", "k-gold"], data: ["db", "k-grey"], edit: ["edit", "k-grey"], remove: ["trash", "k-red"] };
function activity(n) {
  const L = D().log.slice(0, n); if (!L.length) return '<div class="none">Nothing recorded yet.</div>';
  return `<ul class="act">${L.map(e => { const k = KIND[e.k] || KIND.edit; return `<li><span class="when" title="${esc(new Date(e.t).toLocaleString())}">${ago(e.t)}</span><span class="dot ${k[1]}">${ico(k[0])}</span><span class="what">${esc(e.m)}</span></li>`; }).join("")}</ul>`;
}
function battleTable(n) {
  const B = D().battles.slice(0, n); if (!B.length) return '<div class="none">No battles applied yet. Set one up in the combat calculator and press Apply.</div>';
  const nm = L => esc(L[0].name) + (L.length > 1 ? ` <span class="muted">+${L.length - 1}</span>` : "");
  const out = b => { const p = []; if (b.lostD) p.push(`<span class="pill ${b.dSide === "me" ? "red" : "blue"}">${b.lostD} ${sideWord(b.dSide)} destroyed</span>`); if (b.lostA) p.push(`<span class="pill ${b.aSide === "me" ? "red" : "blue"}">${b.lostA} ${sideWord(b.aSide)} destroyed</span>`); return p.join(" ") || '<span class="pill grey">No units lost</span>'; };
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Attacking</th><th>Defending</th><th class="r">Damage</th><th class="r">Of their HP</th><th>Outcome</th></tr></thead><tbody>${B.map(b => `<tr><td class="mono">${hhmm(b.t)}</td><td><span class="sd ${b.aSide}"></span>${nm(b.att)}</td><td><span class="sd ${b.dSide}"></span>${nm(b.def)}</td><td class="r mono">${fx(b.dmg)}${b.cdmg != null ? ` <small class="muted">(counter ${fx(b.cdmg)})</small>` : ""}</td><td class="r mono">${f1(b.pct)}%</td><td>${out(b)}</td></tr>`).join("")}</tbody></table></div>`;
}

/* ---------- MY FORCES: own forces by class and sub class ----------
   Classes fold with UI.fold["mf:<class>"] (open by default); sub classes open with UI.open["mf:<sub class>"] (closed by default). */
const forceSide = () => UI.rosterSide === "foe" || (UI.rosterSide === "ne" && hasCabs()) ? UI.rosterSide : "me";   /* which side the Forces page shows */
function pgForces() {
  const d = D(), fs = forceSide(), U = d.units.filter(u => u.side === fs), T = tot(fs);
  const vc = VIEW && cabById(VIEW.cab), sumHtml = `<div class="ro-sum"><div style="--bc:${vc ? esc(vc.color) : sideCol(fs)}"><span>${esc(vc ? vc.name + " · " + sideLbl(fs) : sideLbl(fs))}</span><b>${T.n} <small>of ${T.all}</small></b><span>units in the field</span></div><div><span>Hit points</span><b>${fx(T.hp)} <small>/ ${fx(T.max)}</small></b><span>${Math.round(pc(T.hp, T.max))}% of starting HP, losses included</span></div><div><span>Attack power</span><b>${fx(T.atk)}</b><span>effective, in the field</span></div><div><span>In reserve</span><b>${T.reserve}</b><span>not deployed</span></div><div><span>Lost</span><b>${T.lost}</b><span>destroyed</span></div></div>`;
  const cls = d.branches.map(b => {
    const BU = U.filter(u => u.branch === b.id), subs = d.types.filter(t => t.branch === b.id), custom = BU.filter(u => !subs.some(t => t.id === u.type));
    const al = BU.filter(u => !lost(u)), hp = sum(al.map(u => u.hp)), mx = sum(al.map(u => u.maxhp)), k = "mf:" + b.id, f = isFold(k);
    return `<section class="panel br-sec mf-cls${f ? " folded" : ""}" style="--bc:${b.color}">
      <header class="br-h" id="fold-${k}" data-a="fold" data-k="${k}" role="button" tabindex="0" aria-expanded="${!f}" title="${f ? "Expand" : "Collapse"}"><h3><span class="chev">${ico("chev")}</span><i class="bsq"></i>${esc(b.name)}</h3>
        <div class="meta"><span><b>${al.length}</b> of ${BU.length} units left</span><span>HP <b>${fx(hp)}</b> / ${fx(mx)}</span><span title="HP of the units still in the field">Unit health <b>${al.length ? Math.round(pc(hp, mx)) + "%" : "—"}</b></span><span>ATK <b>${fx(sum(al.map(u => eff(u).eff)))}</b></span><span>${plural(subs.length, "sub class", "sub classes")}</span></div></header>
      <div class="fold-body">
        ${subs.map(t => subBlock(t, BU.filter(u => u.type === t.id), b)).join("")}${custom.length ? subBlock(null, custom, b) : ""}
        ${!subs.length && !custom.length ? `<div class="none mf-none">No sub classes in ${esc(b.name)} yet.</div>` : ""}
        <div class="mf-add"><button class="btn sm" data-a="subAdd" data-b="${b.id}">${ico("plus")} Add sub class to ${esc(b.name)}</button></div>
      </div></section>`;
  }).join("");
  return head(ROLE === "chair" ? "Forces" : "My forces", `Each side's forces by class and sub class: how many units are left, at what strength and HP. Each row shows where its units are. Open a sub class to see and adjust each unit; add sub classes as the chairs announce them. ${bookletFor() ? "Sub class stats come from the chairs' Military Resources Booklet." : "All sub class stats are placeholders until the chairs' booklet arrives."}`,
    seg("rosterSide", [["me", sideLbl("me")], ["foe", sideLbl("foe")]].concat(hasCabs() ? [["ne", "Neutral"]] : []), fs, "s") + `<button class="btn sm" data-a="mfAll" data-v="0">Collapse all</button><button class="btn sm" data-a="mfAll" data-v="1">Expand all</button><button class="btn sm primary" data-a="addUnits" data-s="${fs}">${ico("plus")} Add units</button>`) + cabBar() + sumHtml + cls;
}
function subBlock(t, units, b) {
  const k = "mf:" + (t ? t.id : "custom-" + b.id), open = !!UI.open[k], al = units.filter(u => !lost(u)), hp = sum(al.map(u => u.hp)), mx = sum(al.map(u => u.maxhp)), st = pc(hp, mx);
  const name = t ? t.name : "Custom units";
  return `<div class="mf-sub${open ? " open" : ""}${units.length ? "" : " no-units"}">
    <div class="mf-sh">
      <button class="mf-tg" id="tg-${k}" data-a="mfOpen" data-k="${k}" aria-expanded="${open}"><span class="chev">${ico("chev")}</span><span class="code" style="--bc:${b.color}">${esc(t ? t.code : "—")}</span><b>${esc(name)}</b></button>
      <div class="mf-left">${units.length ? `<b>${al.length}</b> left of ${units.length}` : '<span class="muted">No units</span>'}</div>
      <div class="rr-sq">${units.slice().sort(byStr).map(u => `<i class="sq t-${tierOf(u)}" title="${esc(u.name)} · HP ${fx(u.hp)}/${fx(u.maxhp)} · ${esc(frontName(u.front))}"></i>`).join("")}</div>
      <div class="rr-str">${al.length ? `<div class="hpbar"><i class="t-${tierKey(st)}" style="width:${st}%"></i></div><span>${Math.round(st)}%</span>` : ""}</div>
      <div class="mf-hp">${al.length ? `HP ${fx(hp)} / ${fx(mx)}<small>ATK ${fx(sum(al.map(u => eff(u).eff)))}</small>` : ""}</div>
      <div class="mf-where">${Object.entries(countBy(al, u => frontName(u.front))).map(([f, n]) => `${esc(f)} <b>${n}</b>`).join(" · ")}</div>
      <div class="mf-tools">${t ? `<button class="icon-btn sm" data-a="subEdit" data-id="${t.id}" aria-label="Edit ${esc(name)}" title="Edit sub class">${ico("edit")}</button><button class="btn sm" data-a="addUnits" data-s="${forceSide()}" data-t="${t.id}">${ico("plus")} Add</button>` : ""}</div>
    </div>
    ${open ? `<div class="mf-units">${units.length ? units.slice().sort(byOrd).map(unitRow).join("") : `<div class="none">No ${esc(name)} units yet. <button class="lnk" data-a="addUnits" data-s="${forceSide()}" data-t="${t ? t.id : ""}">Add some</button></div>`}${t ? `<div class="mf-stats">Sub class stats for new units: ATK ${fx(t.atk)} · HP ${fx(t.hp)} · MOV ${fx(t.mov)} · RNG ${fx(t.rng)}</div>` : ""}</div>` : ""}
  </div>`;
}
function autoCode(name) {
  const w = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean), c = w.length > 1 ? w.map(x => x[0]).join("").slice(0, 5) : (w[0] || "NEW").slice(0, 4);
  let out = c, n = 2; while (D().types.some(t => t.code === out)) out = c + n++; return out;
}
function openSub(branchId, typeId) {
  const d = D(), t = typeId ? d.types.find(x => x.id === typeId) : null; if (typeId && !t) return;
  const b = t ? t.branch : (branchId || d.branches[0].id), n = t ? d.units.filter(u => u.type === t.id).length : 0;
  const nf = (id, l, v, min) => `<div class="fld"><label for="${id}">${l}</label><input id="${id}" type="number" min="${min}" step="0.5" value="${fx(v)}"></div>`;
  openModal(`<h2>${t ? `Edit sub class: ${esc(t.name)}` : `Add a sub class to ${esc(branchById(b).name)}`}</h2><p class="muted">A sub class is a kind of unit inside a class, for example Light Infantry in the Army. Its stats fill in new units${bookletFor() ? " (from the chairs' booklet)" : " and are placeholders until the chairs' booklet arrives"}.</p>
    <div class="fgrid">
      <div class="fld span2"><label for="sbName">Name</label><input id="sbName" value="${esc(t ? t.name : "")}" maxlength="40" placeholder="e.g. Mechanized Infantry"></div>
      <div class="fld"><label for="sbCode">Short code</label><input id="sbCode" value="${esc(t ? t.code : "")}" maxlength="8" placeholder="Automatic"></div>
      <div class="fld"><label for="sbClass">Class</label><select id="sbClass">${d.branches.map(x => `<option value="${x.id}" ${x.id === b ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
      ${nf("sbAtk", "Attack", t ? t.atk : 0, 0)}${nf("sbHp", "Full HP", t ? t.hp : 1, 0.5)}${nf("sbMov", "Movement", t ? t.mov : 0, 0)}${nf("sbRng", "Range", t ? t.rng : 0, 0)}
      ${n ? `<label class="fld span4 chk"><span><input type="checkbox" id="sbPush"> Also give the ${plural(n, "existing unit")} these stats (their HP keeps its share)</span></label>` : ""}
    </div>
    <div class="m-act">${t ? `<button class="btn danger" data-a="subDel" data-id="${t.id}">${ico("trash")} Delete</button><span class="grow"></span>` : ""}<button class="btn" data-a="modalClose">Cancel</button><button class="btn primary" data-a="subGo" data-id="${t ? t.id : ""}">${t ? "Save" : "Add sub class"}</button></div>`);
}
function submitSub(id) {
  const name = $("sbName").value.trim().slice(0, 40); if (!name) { toast("Give the sub class a name"); $("sbName").focus(); return; }
  const code = $("sbCode").value.trim().toUpperCase().slice(0, 8) || autoCode(name);
  const st = { branch: $("sbClass").value, atk: Math.max(0, r2(num($("sbAtk").value))), hp: Math.max(0, r2(num($("sbHp").value))), mov: Math.max(0, r2(num($("sbMov").value))), rng: Math.max(0, r2(num($("sbRng").value))) };
  if (!(st.hp > 0)) { toast("Full HP must be more than 0"); $("sbHp").focus(); return; }
  const push = !!($("sbPush") && $("sbPush").checked);
  closeModal();
  if (id) { act(`Sub class edited: ${name}${push ? " (stats given to its units)" : ""}`, d => { const t = d.types.find(x => x.id === id); if (!t) return; Object.assign(t, { name, code, ...st, ph: false }); d.units.forEach(u => { if (u.type !== id) return; u.tcode = code; u.tname = name; u.branch = st.branch; if (push) { const f = u.maxhp > 0 ? u.hp / u.maxhp : 1; Object.assign(u, { atk: st.atk, mov: st.mov, rng: st.rng, maxhp: st.hp, hp: r2(st.hp * f) }); } }); }, "rules"); return; }
  const nid = uid("t");
  UI.open["mf:" + nid] = true; delete UI.fold["mf:" + st.branch]; saveUI();
  act(`Sub class added: ${name} (${branchById(st.branch).name})`, d => { d.types.push({ id: nid, name, code, ...st, ph: false }); }, "rules");
  toast(`${name} added to ${branchById(st.branch).name}`);
}

/* ---------- ORDER OF BATTLE: drag-and-drop board ---------- */
function pgBoard() {
  const d = D(), side = DEL ? "me" : ROLE === "chair" && !UI.bs ? "both" : UI.boardSide, q = UI.q.trim().toLowerCase();
  const cf = CABS().length && (UI.cabF === "_" || cabById(UI.cabF)) ? UI.cabF : "";
  const vis = u => (side === "both" || u.side === side) && (!UI.br || u.branch === UI.br) && (!cf || (cf === "_" ? !cabById(u.cab) : u.cab === cf)) && (!q || `${u.name} ${u.tname} ${u.tcode} ${cabName(u.cab)}`.toLowerCase().includes(q));
  const mk = (f, i, sd) => {
    const U = d.units.filter(u => u.front === f.id && vis(u) && (!sd || u.side === sd)).sort(byOrd), live = U.filter(u => !lost(u));
    const st = f.id === "lost" ? plural(U.length, "unit") : `${plural(live.length, "unit")} · HP ${fx(sum(live.map(u => u.hp)))}/${fx(sum(live.map(u => u.maxhp)))} · ATK ${fx(sum(live.map(u => eff(u).eff)))}`;
    return `<section class="col ${f.id === "lost" ? "col-lost" : f.id === "reserve" ? "col-res" : ""}" data-front="${f.id}" aria-label="${esc(f.name)}">
      <header class="col-h"><div><h3>${esc(f.name)}</h3><small>${st}</small></div>${f.fixed || sd ? "" : `<button class="icon-btn sm" data-a="colMenu" data-f="${f.id}" aria-label="Options for ${esc(f.name)}" aria-expanded="${UI.colMenu === f.id}">${ico("dots")}</button>`}${!sd && UI.colMenu === f.id ? colMenu(f, i) : ""}</header>
      <div class="col-body" data-keep="col-${sd || ""}${f.id}">${U.map(card).join("")}<div class="col-empty">${f.id === "lost" ? "Units at 0 HP land here" : "Drop units here"}</div></div>
      ${f.id === "lost" || sd ? "" : `<button class="col-add" data-a="addUnits" data-f="${f.id}">${ico("plus")} Add unit</button>`}
    </section>`;
  };
  const deadPanel = (col, n) => `<div class="dead-mid"><div class="panel${foldCls("dead")}">${ph("dead", "Destroyed", `${plural(n, "unit")} · both sides`, "", `${plural(n, "unit")} destroyed`)}<div class="fold-body">${col}</div></div></div>`;
  /* both sides: one half per side with a line down the middle. Reserve sits on the outer edge, deployed fronts next to the line. */
  const half = (sd, flip) => {
    const live = d.fronts.map((f, i) => [f, i]).filter(x => x[0].id !== "lost"), order = flip ? live.slice().reverse() : live;
    return `<div class="half ${sd}"><header class="half-h"><b>${esc(sideLbl(sd))}</b></header><div class="half-cols">${order.map(x => mk(x[0], x[1], sd)).join("")}</div></div>`;
  };
  const neuN = d.units.filter(u => u.side === "ne" && vis(u)).length, neu = ROLE === "chair" && neuN ? `<div class="dead-mid neu-mid"><div class="panel${foldCls("neu")}">${ph("neu", "Neutral parties", `${plural(neuN, "unit")} · they pick a side later`, "", plural(neuN, "unit"))}<div class="fold-body"><div class="half ne"><div class="half-cols">${d.fronts.map((f, i) => f.id === "lost" ? "" : mk(f, i, "ne")).join("")}</div></div></div></div></div>` : "";
  const board = side === "both" ? `<div class="board split" id="board" data-keep="board">${half("me", false)}<div class="half-mid" role="separator" aria-hidden="true"></div>${half("foe", true)}${neu}${d.fronts.map((f, i) => f.id === "lost" ? deadPanel(mk(f, i, null), d.units.filter(u => u.front === "lost" && vis(u)).length) : "").join("")}</div>` : `<div class="board" id="board" data-keep="board">${d.fronts.map((f, i) => mk(f, i, null)).join("")}</div>`;
  return head("Order of battle", "Drag a card between Reserve, the front line and Destroyed (on a tablet: press and hold, then drag). Click a card to edit it. Drop cards on the battle tray below to set up an engagement.", DEL ? "" : seg("boardSide", [["me", sideLbl("me")], ["foe", sideLbl("foe")], ["both", "Both sides"]], side, "s")) + cabBar() + `
  <div class="toolbar">
    <label class="search">${ico("search")}<input id="q" type="search" placeholder="Search units" value="${esc(UI.q)}" data-i="q" aria-label="Search units"></label>
    <div class="chips">${d.branches.map(b => `<button class="chip ${UI.br === b.id ? "on" : ""}" data-a="br" data-b="${b.id}" aria-pressed="${UI.br === b.id}"><i style="background:${b.color}"></i>${esc(b.name)}</button>`).join("")}</div>
    <span class="grow"></span>
    ${bookletFor() ? `<button class="btn primary" data-a="bookAllGo" title="Every country's units from its booklet, at full strength, in Reserve">Load booklet forces</button><button class="btn" data-a="bookPick">Pick countries…</button>` : ""}
    <button class="btn" data-a="frontAdd">${ico("plus")} Add front</button>
  </div>
  ${board}
  ${DEL ? "" : tray()}`;
}
function colMenu(f, i) {
  const n = D().fronts.length;
  return `<div class="colmenu" role="menu"><button data-a="frontRename" data-f="${f.id}" role="menuitem">Rename</button><button data-a="frontMove" data-f="${f.id}" data-d="-1" role="menuitem" ${i <= 1 ? "disabled" : ""}>Move left</button><button data-a="frontMove" data-f="${f.id}" data-d="1" role="menuitem" ${i >= n - 2 ? "disabled" : ""}>Move right</button><button class="danger" data-a="frontDel" data-f="${f.id}" role="menuitem">Delete front</button></div>`;
}
function card(u) {
  const b = branchById(u.branch), s = strOf(u), e = eff(u), L = lost(u);
  return `<article class="card ${u.side === "foe" ? "foe" : ""} ${L ? "is-lost" : ""}" data-id="${u.id}" tabindex="0" style="--bc:${b.color}" aria-label="${esc(u.name)}, ${esc(u.tname)}, HP ${fx(u.hp)} of ${fx(u.maxhp)}">
    <div class="c-top"><span class="code" style="--bc:${b.color}">${esc(u.tcode || "—")}</span><b class="c-name">${cabDot(u.cab)}${esc(u.name)}</b>${UI.boardSide === "both" ? `<span class="sidetag ${u.side}">${u.side === "me" ? "OWN" : u.side === "ne" ? "NEUTRAL" : "ENEMY"}</span>` : ""}</div>
    <div class="hpbar"><i class="t-${tierOf(u)}" style="width:${s}%"></i></div>
    <div class="c-stats"><span>HP <b>${fx(u.hp)}/${fx(u.maxhp)}</b></span><span>STR <b>${L ? "—" : Math.round(s) + "%"}</b></span><span>ATK <b>${fx(e.eff)}</b>${e.eff !== e.base ? `<s>${fx(e.base)}</s>` : ""}</span><span>MOV <b>${fx(u.mov)}</b></span></div>
    <div class="c-act"><button class="mini" data-a="hp" data-id="${u.id}" data-d="-1" aria-label="${esc(u.name)}: lose 1 HP">−1</button><button class="mini" data-a="hp" data-id="${u.id}" data-d="1" aria-label="${esc(u.name)}: gain 1 HP">+1</button>${DEL ? "" : `<button class="mini" data-a="tray" data-id="${u.id}" title="Add to the battle tray" aria-label="${esc(u.name)}: add to the battle tray">${ico("swords")}</button>`}</div>
  </article>`;
}
function tray() {
  const s = selNow(), n = s.A.length + s.D.length;
  return `<div class="panel tray-panel${foldCls("tray")}">${ph("tray", "Quick combat calculation", "Drop units into the two boxes to set up an engagement", "", n ? `${s.A.length} attacking v ${s.D.length} defending` : "No units set up")}<div class="fold-body">${trayBody()}</div></div>`;
}
function trayBody() {
  const s = selNow(), r = currentResult();
  const chip = (u, w) => `<span class="tchip ${u.side}">${esc(u.name)}<button data-a="untray" data-id="${u.id}" data-w="${w}" aria-label="Remove ${esc(u.name)}">${ico("x")}</button></span>`;
  return `<div class="tray" aria-label="Battle tray">
    <div class="tray-z" data-zone="att"><div class="tz-h">ATTACKING · ${esc(sideLbl(s.aS)).toUpperCase()}</div><div class="tz-b">${s.A.map(u => chip(u, "att")).join("") || "<em>Drag attacking units here</em>"}</div></div>
    <div class="tray-vs">VS</div>
    <div class="tray-z" data-zone="def"><div class="tz-h">DEFENDING · ${esc(sideLbl(s.dS)).toUpperCase()}</div><div class="tz-b">${s.D.map(u => chip(u, "def")).join("") || "<em>Drag defending units here</em>"}</div></div>
    <div class="tray-go">${r ? `<div class="q">Estimated damage <b>${fx(r.main.dealt)}</b><br>${f1(r.main.pct)}% of their HP</div>` : `<div class="q">Add at least one unit on each side</div>`}<button class="btn primary" data-a="go" data-p="combat">${ico("swords")} Open calculator</button></div>
  </div>`;
}
function trayPut(u, w) {   /* sets the engagement up; the caller redraws */
  const want = w === "att" ? u.side : other(u.side);
  if (UI.attSide !== want) { UI.attSide = want; const a = UI.sel.att; UI.sel.att = UI.sel.def; UI.sel.def = a; const c = UI.cm.att; UI.cm.att = UI.cm.def; UI.cm.def = c; }
  const o = w === "att" ? "def" : "att"; UI.sel[o] = UI.sel[o].filter(x => x !== u.id); if (!UI.sel[w].includes(u.id)) UI.sel[w].push(u.id);
}
function toTray(id, w) {
  const u = byId(id); if (!u) return;
  if (lost(u)) { toast(`${u.name} is destroyed`); return; }
  trayPut(u, w); saveUI(); render(); toast(`${u.name} added as ${w === "att" ? "attacker" : "defender"}`);
}
/* One click from a unit on the battle map to the combat calculator: the unit goes in (as the attacker, or the defender when the other side is already attacking) and the page switches
   at once. No toast, no fade or slide: the .instant class switches every transition and animation off for the moment of the switch. */
function toCalc(id) {
  const u = byId(id); if (!u) return;
  if (lost(u)) { toast(`${u.name} is destroyed`); return; }
  trayPut(u, u.side === UI.attSide ? "att" : "def");
  const r = document.documentElement; r.classList.add("instant"); go("combat");
  requestAnimationFrame(() => requestAnimationFrame(() => r.classList.remove("instant")));
}
function moveUnit(id, front, ids) {
  const u = byId(id); if (!u) { render(); return; }
  const from = u.front, revive = from === "lost" && front !== "lost" && !(u.hp > 0);
  act(from === front ? null : `${u.name} moved: ${frontName(from)} → ${frontName(front)}`, d => {
    const x = d.units.find(y => y.id === id); moveTo(d, x, front);
    ids.forEach((y, i) => { const z = d.units.find(q => q.id === y); if (z) z.ord = i; });
  }, "move");
  if (front === "lost" && from !== "lost") toast(`${u.name} marked destroyed (HP 0). Undo if that was a mistake.`);
  if (revive) toast(`${u.name} is back with 1 HP. Edit its HP on the card.`);
}

/* ---------- BATTLE OVERVIEW: what is left, by class and sub class ---------- */
function pgRoster() {
  const s = DEL ? "me" : UI.rosterSide;
  const body = s === "both" ? `<div class="ro-two"><div>${rosterSide("me", true)}</div><div>${rosterSide("foe", true)}</div></div>` : rosterSide(s, false);
  const keys = [...D().branches.map(b => "ro:" + b.id), "ro:other"];
  return head("Battle overview", "What is left in each part of the armed forces: how many units of each sub class, at what strength and HP. Click a class to collapse it, or a row to see every unit and adjust it.", (DEL ? "" : seg("rosterSide", [["me", sideLbl("me")], ["foe", sideLbl("foe")], ["both", "Side by side"]], s, "s")) + foldAll(keys)) + body;
}
function rosterSide(s, narrow) {
  const d = D(), U = d.units.filter(u => u.side === s);
  if (!U.length) return `<div class="panel"><div class="none big">No ${esc(sideLbl(s))} units recorded yet.<div class="row-btns" style="justify-content:center"><button class="btn primary" data-a="addUnits" data-s="${s}">${ico("plus")} Add units</button></div></div></div>`;
  const T = tot(s), G = groupTypes(U);
  const sumHtml = `<div class="ro-sum ${narrow ? "narrow" : ""}"><div style="--bc:${sideCol(s)}"><span>${esc(sideLbl(s))}</span><b>${T.n} <small>of ${T.all}</small></b><span>units in the field</span></div><div><span>Hit points</span><b>${fx(T.hp)} <small>/ ${fx(T.max)}</small></b><span>${Math.round(pc(T.hp, T.max))}% of starting HP, losses included</span></div><div><span>Attack power</span><b>${fx(T.atk)}</b><span>effective, in the field</span></div><div><span>In reserve</span><b>${T.reserve}</b><span>not on a front</span></div><div><span>Lost</span><b>${T.lost}</b><span>destroyed</span></div></div>`;
  const brs = d.branches.map(b => ({ b, G: G.filter(g => g.branch === b.id) })).filter(x => x.G.length);
  const orphan = G.filter(g => !d.branches.some(b => b.id === g.branch)); if (orphan.length) brs.push({ b: { id: "", name: "Other", color: "#6b7380" }, G: orphan });
  return sumHtml + brs.map(({ b, G }) => {
    const al = G.flatMap(g => g.alive), all = G.flatMap(g => g.units), hp = sum(al.map(u => u.hp)), mx = sum(al.map(u => u.maxhp));
    const k = "ro:" + (b.id || "other"), f = isFold(k);   /* same key on both sides, so side-by-side columns fold together */
    return `<section class="panel br-sec${f ? " folded" : ""}" style="--bc:${b.color}"><header class="br-h" id="fold-${k}-${s}" data-a="fold" data-k="${k}" role="button" tabindex="0" aria-expanded="${!f}" title="${f ? "Expand" : "Collapse"}"><h3><span class="chev">${ico("chev")}</span><i class="bsq"></i>${esc(b.name)}</h3><div class="meta"><span><b>${al.length}</b> of ${all.length} units left</span><span>HP <b>${fx(hp)}</b> / ${fx(mx)}</span><span title="HP of the units still in the field">Unit health <b>${al.length ? Math.round(pc(hp, mx)) + "%" : "—"}</b></span><span>ATK <b>${fx(sum(al.map(u => eff(u).eff)))}</b></span></div></header>
      <div class="fold-body"><div class="rr-head ${narrow ? "narrow" : ""}"><span>Sub class</span><span>Left</span><span>Each unit</span><span>Avg strength</span><span>HP</span><span>ATK</span><span class="rr-where">Where</span><span></span></div>
      ${G.map(g => rosterRow(g, s, narrow)).join("")}</div></section>`;
  }).join("");
}
function rosterRow(g, s, narrow) {
  const k = s + ":" + g.k, open = !!UI.open[k], st = pc(g.hp, g.max), where = countBy(g.alive, u => frontName(u.front));
  return `<div class="rr ${open ? "open" : ""} ${narrow ? "narrow" : ""}" data-a="rtoggle" data-k="${esc(k)}" role="button" tabindex="0" aria-expanded="${open}">
    <div class="rr-type"><span class="code" style="--bc:${branchById(g.branch).color}">${esc(g.code)}</span><b>${esc(g.name)}</b></div>
    <div class="rr-left"><b>${g.nA}</b> left <small>of ${g.units.length}</small></div>
    <div class="rr-sq">${g.units.slice().sort(byStr).map(u => `<i class="sq t-${tierOf(u)}" title="${esc(u.name)} · HP ${fx(u.hp)}/${fx(u.maxhp)} · ${esc(frontName(u.front))}"></i>`).join("")}</div>
    <div class="rr-str"><div class="hpbar"><i class="t-${g.nA ? tierKey(st) : "lost"}" style="width:${st}%"></i></div><span>${g.nA ? Math.round(st) + "%" : "—"}</span></div>
    <div class="rr-hp mono">${fx(g.hp)} / ${fx(g.max)}</div>
    <div class="rr-atk mono">${fx(g.atk)}</div>
    <div class="rr-where">${Object.entries(where).map(([f, n]) => `${esc(f)} <b>${n}</b>`).join(" · ") || "—"}</div>
    <span class="chev">${ico("chev")}</span></div>
    ${open ? `<div class="rr-units">${g.units.slice().sort(byOrd).map(unitRow).join("")}</div>` : ""}`;
}
function unitRow(u) {
  const e = eff(u);
  return `<div class="ru ${lost(u) ? "is-lost" : ""}"><b>${esc(u.name)}</b>
    <select class="sel" data-c="ufront" data-id="${u.id}" id="rf-${u.id}" aria-label="Front of ${esc(u.name)}">${frontOpts(u.front)}</select>
    <span class="step"><button data-a="hp" data-id="${u.id}" data-d="-1" aria-label="${esc(u.name)}: lose 1 HP">−</button><input id="rh-${u.id}" type="number" step="0.5" min="0" max="${u.maxhp}" value="${fx(u.hp)}" data-c="uhp" data-id="${u.id}" aria-label="HP of ${esc(u.name)}"><button data-a="hp" data-id="${u.id}" data-d="1" aria-label="${esc(u.name)}: gain 1 HP">+</button></span>
    <span class="mono">/ ${fx(u.maxhp)} · ${lost(u) ? "lost" : Math.round(strOf(u)) + "%"}</span><span class="mono">ATK ${fx(e.eff)}</span>
    <button class="lnk" data-a="open" data-id="${u.id}">Edit</button></div>`;
}

/* ---------- COMBAT CALCULATOR ---------- */
const RCH = [["useMorale", "Morale"], ["useStr", "Strength penalty"], ["useMod", "Combat modifier"], ["useMult", "Multiplier"], ["useBonus", "Bonus"], ["useChart", "Results chart"], ["useCounter", "Counter-attack"]];
const ruleChips = () => { const R = D().rules; return `<span class="eyebrow">Rules in use</span>` + RCH.map(([k, l]) => `<button class="rchip ${R[k] ? "on" : ""}" data-a="rule" data-k="${k}" aria-pressed="${!!R[k]}" title="Click to switch ${R[k] ? "off" : "on"}"><i></i>${l}: ${R[k] ? "ON" : "OFF"}</button>`).join("") + `<span class="rchip static"><i style="background:var(--gold)"></i>Spread: ${SPREAD[R.spread]}</span>`; };
function pgCombat() {
  const d = D(), R = d.rules, s = selNow(), r = currentResult(), am = moraleNow("att"), dm = moraleNow("def");
  const rng = (id, w, label, v, sub) => `<div class="fld"><label for="${id}">${label}</label><div class="rng"><input type="range" min="0" max="100" step="1" value="${v}" id="${id}r" data-i="pair" data-pair="${id}" data-c="cm" data-w="${w}" aria-label="${label}"><input type="number" id="${id}" min="0" max="100" step="1" value="${fx(v)}" data-i="pair" data-pair="${id}r" data-c="cm" data-w="${w}"></div><small>${sub}</small></div>`;
  const mid = `<div class="panel cb-mid"><div class="panel-h"><div><h3>Conditions</h3><p>Applied to this engagement only</p></div></div>
    ${R.useMorale ? rng("am", "att", "Attacker morale %", am, UI.cm.att != null ? `<button class="lnk" data-a="cmReset" data-w="att">Use ${esc(moraleSrc("att", s))} morale (${fx(Math.round(groupMorale(s.A, s.aS)))}%)</button>` : `From ${esc(moraleSrc("att", s))}`) : `<div class="note">Morale is switched off, so it is not part of the damage.</div>`}
    ${R.useCounter && R.useMorale ? rng("dm", "def", "Defender morale % (counter-attack)", dm, UI.cm.def != null ? `<button class="lnk" data-a="cmReset" data-w="def">Use ${esc(moraleSrc("def", s))} morale (${fx(Math.round(groupMorale(s.D, s.dS)))}%)</button>` : `From ${esc(moraleSrc("def", s))}`) : ""}
    ${R.useMult ? `<div class="fld"><label for="mult">Situational multiplier</label><div class="mult"><input id="mult" type="number" step="0.05" min="0" value="${UI.mult}" data-c="mult">${[0.5, 0.75, 1, 1.25, 1.5, 2].map(v => `<button class="chip ${num(UI.mult) === v ? "on" : ""}" data-a="multSet" data-v="${v}">×${v}</button>`).join("")}</div><small>Terrain, fortification, surprise: whatever the chairs rule.</small></div>` : ""}
    ${R.useBonus ? `<div class="fld"><label for="bonus">Flat bonus damage</label><input id="bonus" type="number" step="0.5" value="${UI.bonus}" data-c="bonus"></div>` : ""}
    ${[...s.A, ...s.D].some(isArty) ? artyBox(s) : ""}
    <div class="formula-mini">Damage formula<code>${esc(formula(R).err ? STD_EXPR : R.expr)}</code></div></div>`;
  return head("Combat calculator", "Tick the units in the engagement. The estimate updates as you go; nothing changes on the forces until you press Apply.", `<button class="btn primary" data-a="warMap" title="Open the battle map with the menu closed">${ico("map")} War map</button><button class="btn" data-a="swap">${ico("move")} Swap attacker and defender</button><button class="btn" data-a="clearSel">Clear</button>`) + `
  <section class="cb-grid">${pickPanel("att", s.aS, s.A)}${mid}${pickPanel("def", s.dS, s.D)}</section>
  <section class="panel">${r ? resultHTML(r) : '<div class="none big">Tick at least one attacking unit and one defending unit to see the estimate.</div>'}</section>
  <section class="panel"><div class="panel-h"><div><h3>Battle record</h3></div></div>${battleTable(12)}</section>`;
}
function artyBox(s) {
  const R = D().rules, names = [...s.A, ...s.D].filter(isArty).map(u => u.name), can = R.useCounter || R.useChart;
  return `<div class="fld"><label>Artillery in this engagement</label><div class="mult"><button class="chip ${UI.arty ? "" : "on"}" data-a="artySet" data-v="dmg" aria-pressed="${!UI.arty}">Takes damage</button><button class="chip ${UI.arty ? "on" : ""}" data-a="artySet" data-v="safe" aria-pressed="${!!UI.arty}">Only hits</button></div><small>${esc(names.join(", "))}. ${UI.arty ? "They deal their damage but take none: not from the counter-attack, not from the results chart, not when they are the target." : "They are damaged like any other unit."}${can ? "" : " Counter-attack and the results chart are both off, so nothing can hurt the attackers right now anyway."}</small></div>`;
}
function pickPanel(w, s, selU) {
  const d = D(), ids = new Set(selU.map(u => u.id)), U = d.units.filter(u => u.side === s && !lost(u)), fr = d.fronts.filter(f => U.some(u => u.front === f.id));
  return `<div class="panel pick-p ${s}"><div class="panel-h"><div><div class="eyebrow">${w === "att" ? "Attacking" : "Defending"}</div><h3>${esc(sideLbl(s))}</h3></div><div class="pk-sum"><b>${selU.length}</b> ticked<br>ATK ${fx(sum(selU.map(u => eff(u).eff)))} · HP ${fx(sum(selU.map(u => u.hp)))}</div></div>
    <div class="pk-list" data-keep="pk-${w}">${fr.map(f => { const FU = U.filter(u => u.front === f.id).sort(byOrd), all = FU.every(u => ids.has(u.id)); return `<div class="pk-g"><div class="pk-gh"><span>${esc(f.name)}</span><button class="lnk" data-a="pickall" data-w="${w}" data-f="${f.id}">${all ? "Untick all" : "Tick all"}</button></div>${FU.map(u => { const e = eff(u), st = strOf(u), on = ids.has(u.id); return `<label class="pk ${on ? "on" : ""}"><input type="checkbox" data-c="pick" data-w="${w}" data-id="${u.id}" id="pk-${w}-${u.id}" ${on ? "checked" : ""}><span class="pk-n"><b>${esc(u.name)}</b><small>${esc(u.tcode || "")} · STR ${Math.round(st)}%</small></span><span class="pk-hp"><span class="hpbar sm"><i class="t-${tierOf(u)}" style="width:${st}%"></i></span>${fx(u.hp)}/${fx(u.maxhp)}</span><span class="pk-atk">${fx(e.eff)}<small>ATK</small></span></label>`; }).join("")}</div>`; }).join("") || `<div class="none">No ${esc(sideLbl(s))} units in the field.</div>`}</div></div>`;
}
function resultHTML(r) {
  const M = r.main, R = D().rules, s = selNow();
  const hB0 = sum(r.B.map(u => u.hp)), hB1 = sum(r.B.map(u => r.hB.get(u.id))), hA0 = sum(r.A.map(u => u.hp)), hA1 = sum(r.A.map(u => r.hA.get(u.id)));
  const kB = r.B.filter(u => !(r.hB.get(u.id) > 0)).length, kA = r.A.filter(u => !(r.hA.get(u.id) > 0)).length;
  const verdict = `<div class="verdict"><div><div class="eyebrow">Estimated damage · ${esc(sideLbl(s.aS))} attacks</div><div class="v-num">${fx(M.dealt)}</div><div class="v-sub">${f1(M.pct)}% of the defenders' ${fx(M.V.hp)} HP${M.row ? ` · results chart: ${esc(rowLabel(R, M.row))}` : ""}</div></div>
    <div class="v-facts"><div><span>Defenders destroyed</span><b>${kB} of ${r.B.length}</b></div><div><span>Attackers destroyed</span><b>${kA} of ${r.A.length}</b></div>${r.counter ? `<div><span>Counter-attack</span><b>${fx(r.counter.dealt)}</b></div>` : ""}${r.over > 0 ? `<div><span>Overkill</span><b>${fx(r.over)}</b></div>` : ""}</div></div>`;
  const shore = r.noShip.length ? `<div class="warnbox"><b>Shore rule.</b> Troops on land cannot damage ships, so ${r.noShip.map(u => esc(u.name)).join(", ")} deal${r.noShip.length === 1 ? "s" : ""} no damage here. They can still damage hostiles on the shore.</div>` : "";
  const dn = (a, b, s2, cap) => `<figure>${CH.donut([{ v: b, c: sideCol(s2), t: "HP left" }, { v: a - b, c: "var(--t-lost)", t: "HP lost" }], Math.round(pc(b, a)) + "%", "HP LEFT", { size: 150, sw: 20, label: cap })}<figcaption>${cap}<br>${fx(b)} of ${fx(a)} HP</figcaption></figure>`;
  const rows = [...r.A.map(u => [u, r.hA.get(u.id), "Attacking"]), ...r.B.map(u => [u, r.hB.get(u.id), "Defending"])];
  const table = `<table class="tbl"><thead><tr><th>Unit</th><th>Role</th><th class="r">HP before</th><th class="r">HP after</th><th class="r">Change</th><th style="width:28%">Strength after</th></tr></thead><tbody>${rows.map(([u, a, w]) => { const ch = r2(a - u.hp), st = u.maxhp > 0 ? a / u.maxhp * 100 : 0; return `<tr><td><span class="sd ${u.side}"></span><b>${esc(u.name)}</b> <small class="muted">${esc(u.tcode || "")}</small>${r.safe.has(u.id) ? ' <span class="pill grey">Only hits</span>' : ""}</td><td>${w}</td><td class="r mono">${fx(u.hp)}</td><td class="r mono">${fx(a)}</td><td class="r mono ${ch < 0 ? "neg" : ""}">${ch < 0 ? "−" + fx(-ch) : "0"}</td><td>${a > 0 ? `<div class="hpbar"><i class="t-${tierKey(st)}" style="width:${st}%"></i></div>` : '<span class="pill red">Destroyed</span>'}</td></tr>`; }).join("")}</tbody></table>`;
  return `${verdict}${shore}${M.ferr ? `<div class="warnbox">Your custom formula has an error (${esc(M.ferr)}), so the standard Attack × Morale formula was used. Fix it on Rules &amp; formulas.</div>` : ""}
    <div class="res-grid"><div class="res-d">${dn(hB0, hB1, s.dS, "Defenders")}${dn(hA0, hA1, s.aS, "Attackers")}</div><div class="tbl-wrap">${table}</div></div>
    <details class="steps" data-k="steps" ${UI.steps ? "open" : ""}><summary>Show the working</summary>${steps(r)}</details>
    <div class="res-act"><button class="btn primary lg" data-a="apply">${ico("swords")} ${ROLE === "chair" ? "Apply result to both sides" : "Apply result to forces"}</button><span class="muted">An estimate only: the chairs decide the real outcome. Apply it once they confirm. Undo is available.</span></div>`;
}
function steps(r) {
  const R = D().rules, M = r.main, li = []; let n = 1;
  const line = x => `${esc(x.u.name)}${x.k ? ` (destroyed, strikes back at ${Math.round(x.k * 100)}%)` : ""}: ATK ${fx(x.base)} at ${Math.round(x.s)}% strength` + (x.dir ? ` (includes ${sgn(x.dir)} from the ${esc(sideLbl(x.u.side))} directives)` : "") + (x.none ? " → too weak to attack" : (x.pen ? `, ${sgn(x.pen)} strength penalty` : "") + (x.mod ? `, ${sgn(x.mod)} combat modifier` : "")) + ` = <b>${fx(x.eff)}</b>`;
  const vs = V => exprVars(M.ferr ? STD_EXPR : R.expr).map(k => `${k} = ${fx(V[k])}`).join(", ");
  li.push(`<li><h4>${n++} · Effective attack</h4><ul>${M.parts.map(x => `<li>${line(x)}</li>`).join("")}</ul><p>Together: <b>${fx(M.V.atk)}</b>${!R.useStr && !R.useMod ? " (no strength rules switched on)" : ""}</p></li>`);
  li.push(`<li><h4>${n++} · Damage formula</h4><p><code>${esc(M.ferr ? STD_EXPR : R.expr)}</code> with ${vs(M.V)} = <b>${fx(M.raw)}</b>${R.rounding !== "none" ? `, ${RND[R.rounding]}: <b>${fx(M.dmg)}</b>` : ""}${R.useMorale ? "" : " (morale is off, so it counts as 100%)"}</p></li>`);
  if (R.useChart && M.row) li.push(`<li><h4>${n++} · Results chart</h4><p>${fx(M.dmg)} damage is ${f1(M.pct)}% of the defenders' ${fx(M.V.hp)} HP → row <b>${esc(rowLabel(R, M.row))}</b>: the defenders take ${fx(M.row.tDmg)}% of it (<b>${fx(M.dealt)}</b>)${num(M.row.aLoss) > 0 ? `, the attackers lose ${fx(M.row.aLoss)}% of their HP` : ""}${M.row.note ? ` · ${esc(M.row.note)}` : ""}</p></li>`);
  li.push(`<li><h4>${n++} · Spread over the defenders (${SPREAD[R.spread]})</h4><ul>${r.B.map(u => `<li>${esc(u.name)}: ${fx(u.hp)} → <b>${fx(r.hB.get(u.id))}</b>${r.safe.has(u.id) ? " (artillery only hits, so it takes no damage)" : ""}${zoneNote(r, u)}</li>`).join("")}</ul>${r.over > 0 ? `<p>${fx(r.over)} damage left over (overkill).</p>` : ""}</li>`);
  if (r.counter && r.counter.safe) li.push(`<li><h4>${n++} · Counter-attack</h4><p>No damage: every attacker is artillery set to “only hits”.</p></li>`);
  else if (r.counter && r.counter.none) li.push(`<li><h4>${n++} · Counter-attack</h4><p>No counter-attack: every defender was destroyed by the hit.</p></li>`);
  else if (r.counter) li.push(`<li><h4>${n++} · Counter-attack</h4><p>The defenders still standing strike back at full strength, however little HP they have left: effective attack ${fx(r.counter.V.atk)}${R.useMorale ? `, morale ${fx(r.counter.V.morale)}%` : ""} → <b>${fx(r.counter.dealt)}</b> damage over the attackers (no multiplier or bonus).</p><ul>${r.A.map(u => `<li>${esc(u.name)}: ${fx(u.hp)} → <b>${fx(r.hA.get(u.id))}</b>${r.safe.has(u.id) ? " (artillery only hits, so it takes no damage)" : ""}</li>`).join("")}</ul></li>`);
  return `<ol class="work">${li.join("")}</ol>`;
}

/* ---------- RULES & FORMULAS (editable calculation system) ---------- */
function ruleSentence(R) {
  const p = [`Each unit attacks with its ATK${R.useStr ? ", lowered when it is weakened (strength penalty)" : ""}${R.useMod ? `${R.useStr ? " and" : ","} adjusted by the combat modifier for its strength` : ""}.`,
    `The attacking units' attack is added up and put through <code>${esc(R.expr)}</code>${R.useMorale ? "" : ", with morale switched off (it counts as 100%)"}.`];
  if (R.useChart) p.push("The damage, as a % of the defenders' HP, is looked up on the results chart.");
  p.push(`The damage is spread ${SPREAD_S[R.spread]}, ${RND[R.rounding]}.`);
  if (R.useCounter) p.push("The defenders strike back at the same time with the same formula.");
  p.push(R.autoLost ? "Units at 0 HP move to Destroyed." : "Units at 0 HP stay where they are but count as lost.");
  return p.join(" ");
}
/* Topic 2: each country's own copy of the sub class stats, starting from the base. Changing one only changes that country; new units of the country use it,
   and "Update units" gives the country's units these stats. */
function cabTypesPanel(d) {
  const rc = cabById(UI.ruleCab) ? UI.ruleCab : CABS()[0].id, c = cabById(rc), ov = (d.cabTypes && d.cabTypes[rc]) || {};
  const tabs = `<nav class="cab-bar" aria-label="Country">${CABS().map(x => `<button class="cb-chip${x.id === rc ? " on" : ""}" data-a="ruleCab" data-c="${x.id}" aria-pressed="${x.id === rc}"><i style="background:${esc(x.color)}"></i><b>${esc(x.name)}</b>${d.cabTypes && d.cabTypes[x.id] && Object.keys(d.cabTypes[x.id]).length ? "<small>edited</small>" : ""}</button>`).join("")}</nav>`;
  const rows = d.types.map(t => { const x = typeFor(d, t, rc), o = ov[t.id] || {}, n = d.units.filter(u => u.type === t.id && u.cab === rc && !u.remote).length;
    return `<tr${ov[t.id] ? ' class="ct-ed"' : ""}><td><span class="code" style="--bc:${branchById(t.branch).color}">${esc(t.code)}</span></td><td>${esc(t.name)}</td>${["atk", "hp", "mov", "rng"].map(k => `<td class="r"><input class="n${o[k] != null && o[k] !== t[k] ? " ct-ch" : ""}" type="number" min="0" step="0.5" value="${fx(x[k])}" data-c="ctype" data-cab="${rc}" data-id="${t.id}" data-k="${k}" id="ct-${rc}-${t.id}-${k}" aria-label="${esc(c.name)} ${esc(t.code)} ${k}" title="Base: ${fx(t[k])}"></td>`).join("")}<td class="r mono">${n}</td><td class="nowrap"><button class="btn sm" data-a="typePush" data-id="${t.id}" data-cab="${rc}" ${n ? "" : "disabled"} title="Give ${esc(c.name)}'s ${esc(t.name)} units these stats (HP keeps its share)">Update units</button>${ov[t.id] ? ` <button class="btn sm plain" data-a="ctypeReset" data-id="${t.id}" data-cab="${rc}">Base</button>` : ""}</td></tr>`; }).join("");
  return `<section class="panel"><div class="panel-h"><div><h3>Sub class stats by country</h3><p>Each country starts from the base stats below. Change a number here and only ${esc(c.name)} gets it: its new units use it, and “Update units” gives its existing units the new stats. Changed figures are marked; hover a field to see the base value.</p></div>${Object.keys(ov).length ? `<button class="btn sm" data-a="ctypeResetAll" data-cab="${rc}">Reset ${esc(c.name)} to base</button>` : ""}</div>
    ${tabs}<div class="tbl-wrap"><table class="tbl types"><thead><tr><th>Code</th><th>Name</th><th class="r">ATK</th><th class="r">HP</th><th class="r">MOV</th><th class="r">RNG</th><th class="r">Units</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function pgRules() {
  const d = D(), R = d.rules, F = formula(R);
  const step = (n, title, key, desc, body) => `<li class="pipe-s ${key && !R[key] ? "off" : ""}"><div class="pipe-n">${n}</div><div class="pipe-b"><div class="pipe-h"><h3>${title}</h3>${key ? swBtn(key, R[key]) : ""}</div><p>${desc}</p>${!key || R[key] ? body : ""}</div></li>`;
  const ni = (t, i, k, v, extra = "") => `<input class="n" type="number" step="any" value="${fx(v)}" data-c="rt" data-t="${t}" data-n="${i}" data-k="${k}" id="rt-${t}-${i}-${k}" ${extra}>`;
  const strT = `<table class="rtbl"><thead><tr><th>When strength is</th><th>Attack change</th><th></th></tr></thead><tbody>${R.str.map((r, i) => `<tr><td>${r.noAtk ? "below" : "at or below"} ${ni("str", i, "upTo", r.upTo, 'min="0" max="100"')} %</td><td>${r.noAtk ? "<b>cannot attack</b>" : ni("str", i, "atk", r.atk) + " ATK"}</td><td><button class="icon-btn sm" data-a="rtDel" data-t="str" data-n="${i}" aria-label="Remove row">${ico("x")}</button></td></tr>`).join("")}</tbody></table><div class="row-btns"><button class="btn sm" data-a="rtAdd" data-t="str">Add row</button>${R.str.some(r => r.noAtk) ? "" : '<button class="btn sm" data-a="rtAdd" data-t="strNo">Add a “cannot attack” row</button>'}<button class="btn sm plain" data-a="rtReset" data-t="str">Restore default</button></div>`;
  const modT = `<table class="rtbl"><thead><tr><th>From strength</th><th>Attack change</th><th></th></tr></thead><tbody>${R.mod.map((r, i) => `<tr><td>${ni("mod", i, "min", r.min, 'min="0" max="100"')} % and up</td><td>${ni("mod", i, "mod", r.mod)} ATK</td><td><button class="icon-btn sm" data-a="rtDel" data-t="mod" data-n="${i}" aria-label="Remove row">${ico("x")}</button></td></tr>`).join("")}</tbody></table><div class="row-btns"><button class="btn sm" data-a="rtAdd" data-t="mod">Add row</button><button class="btn sm plain" data-a="rtReset" data-t="mod">Restore default</button></div>`;
  const chartT = `<table class="rtbl"><thead><tr><th>From % of damage</th><th>Defenders take</th><th>Attackers lose</th><th>Note</th><th></th></tr></thead><tbody>${R.chart.map((r, i) => `<tr><td>${ni("chart", i, "min", r.min, 'min="0"')} %</td><td>${ni("chart", i, "tDmg", r.tDmg, 'min="0"')} % of it</td><td>${ni("chart", i, "aLoss", r.aLoss, 'min="0" max="100"')} % of HP</td><td><input class="note-in" value="${esc(r.note || "")}" data-c="rt" data-t="chart" data-n="${i}" data-k="note" id="rt-chart-${i}-note" maxlength="80"></td><td><button class="icon-btn sm" data-a="rtDel" data-t="chart" data-n="${i}" aria-label="Remove row">${ico("x")}</button></td></tr>`).join("")}</tbody></table><div class="row-btns"><button class="btn sm" data-a="rtAdd" data-t="chart">Add row</button><button class="btn sm plain" data-a="rtReset" data-t="chart">Restore placeholder chart</button></div>`;
  const term = (k, title, txt) => `<div class="term"><div><b>${title}</b><p>${txt}</p></div>${swBtn(k, R[k])}</div>`;
  const fbox = `<div class="presets">${Object.entries(FORMULAS).map(([k, f]) => `<button class="preset ${R.expr.replace(/\s+/g, "") === f.expr.replace(/\s+/g, "") ? "on" : ""}" data-a="preset" data-f="${k}"><b>${f.name}</b><small>${f.desc}</small><code>${f.expr}</code></button>`).join("")}</div>
    <label class="lbl" for="expr">Formula (edit freely, press Enter or click away to save)</label>
    <input id="expr" class="expr mono" value="${esc(R.expr)}" data-c="expr" data-i="exprLive" spellcheck="false" autocomplete="off">
    <div id="exprMsg" class="expr-msg ${F.err ? "bad" : "ok"}">${F.err ? "Problem: " + esc(F.err) + ". The standard formula is used until this is fixed." : "Formula is valid." + exprWarn(F.f)}</div>
    <div class="terms">${term("useMorale", "Morale", "When off, morale counts as 100%, so it drops out of the damage. Use this when the chairs take morale out of combat.")}${term("useMult", "Situational multiplier", "A ×-value you set per battle (terrain, fortification, surprise). When off it is 1.")}${term("useBonus", "Flat bonus damage", "A number you add per battle. When off it is 0.")}</div>
    <details class="vars"><summary>Names and functions you can use</summary><table>${VARS.map(([k, t]) => `<tr><td><code>${k}</code></td><td>${t}</td></tr>`).join("")}</table><p>Functions: min(a, b), max(a, b), round(x), floor(x), ceil(x), abs(x), sqrt(x), pow(a, b), clamp(x, lo, hi), if(test, a, b). Compare with &gt; &lt; &gt;= &lt;= == != (true counts as 1). Dividing by 0 gives 0.</p></details>
    <div class="trial"><label>atk<input class="n" type="number" step="any" value="${fx(UI.tv.atk)}" data-i="tv" data-k="atk" id="tv-atk"></label><label>morale %<input class="n" type="number" step="any" value="${fx(UI.tv.morale)}" data-i="tv" data-k="morale" id="tv-morale" ${R.useMorale ? "" : "disabled"}></label><label>defenders' hp<input class="n" type="number" step="any" value="${fx(UI.tv.hp)}" data-i="tv" data-k="hp" id="tv-hp"></label><div class="out" id="trialOut">${trialText()}</div></div>`;
  const fin = `<div class="fgrid"><div class="fld span2"><label for="r-spread">Spread over several defenders</label><select id="r-spread" data-c="rsel" data-k="spread">${Object.entries(SPREAD).map(([k, l]) => `<option value="${k}" ${R.spread === k ? "selected" : ""}>${l}</option>`).join("")}</select><small>Damage is spread ${SPREAD_S[R.spread]}.</small></div><div class="fld span2"><label for="r-round">Rounding of damage</label><select id="r-round" data-c="rsel" data-k="rounding">${Object.entries(RND).map(([k, l]) => `<option value="${k}" ${R.rounding === k ? "selected" : ""}>${l[0].toUpperCase() + l.slice(1)}</option>`).join("")}</select></div></div>
    <div class="terms">${term("useCounter", "Counter-attack", "The defenders strike back at the same time with the same formula (using their morale, no multiplier or bonus). A defender wiped out by the attack still strikes back, at the share set below.")}${term("autoLost", "Move units at 0 HP to Destroyed", "When off, a unit at 0 HP stays on its front but counts as lost.")}</div>
    ${R.useCounter ? `<div class="fgrid"><div class="fld span2"><label for="r-dead">Counter-attack of a destroyed defender</label><input id="r-dead" class="n" type="number" min="0" max="100" step="5" value="${fx(num(R.deadCounter, 50))}" data-c="rnum" data-k="deadCounter"><small>% of its attack. A defender the attack wipes out still strikes back with this share (0 turns it off).</small></div></div>` : ""}`;
  const types = d.types.map(t => { const n = d.units.filter(u => u.type === t.id).length; return `<tr><td><input class="in code-in" value="${esc(t.code)}" data-c="type" data-id="${t.id}" data-k="code" id="ty-${t.id}-code" maxlength="8" aria-label="Code"></td><td><input class="in" value="${esc(t.name)}" data-c="type" data-id="${t.id}" data-k="name" id="ty-${t.id}-name" maxlength="40" aria-label="Name">${t.ph && !bookletFor() ? '<span class="tag-ph">PLACEHOLDER</span>' : ""}</td><td><select class="in" data-c="type" data-id="${t.id}" data-k="branch" id="ty-${t.id}-branch" aria-label="Branch">${d.branches.map(b => `<option value="${b.id}" ${b.id === t.branch ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></td>${["atk", "hp", "mov", "rng"].map(k => `<td class="r"><input class="n" type="number" min="0" step="0.5" value="${fx(t[k])}" data-c="type" data-id="${t.id}" data-k="${k}" id="ty-${t.id}-${k}" aria-label="${k}"></td>`).join("")}<td class="r mono">${n}</td><td class="nowrap"><button class="btn sm" data-a="typePush" data-id="${t.id}" ${n ? "" : "disabled"} title="Give every unit of this sub class these stats (HP keeps its share)">Update units</button> <button class="icon-btn sm" data-a="typeDel" data-id="${t.id}" aria-label="Delete sub class">${ico("trash")}</button></td></tr>`; }).join("");
  const dside = UI.ruleSide === "foe" ? "foe" : "me", drows = ((R.dir && R.dir[dside]) || []);
  const dopt = cur => `<option value="*" ${cur === "*" ? "selected" : ""}>All units</option>` + d.branches.map(b => `<option value="b:${b.id}" ${cur === "b:" + b.id ? "selected" : ""}>All ${esc(b.name)}</option>`).join("") + d.types.map(t => `<option value="c:${esc(t.code)}" ${cur === "c:" + t.code ? "selected" : ""}>${esc(t.name)} (${esc(t.code)})</option>`).join("");
  const dirs = `<section class="panel"><div class="panel-h"><div><h3>Directives by side</h3><p>Standing orders for one side only, such as +2 ATK to its standard infantry for a new rifle. They add to the ATK on the card in every battle, and the working shows them.</p></div>${seg("ruleSide", [["me", sideLbl("me")], ["foe", sideLbl("foe")]], dside, "s")}</div>
    ${drows.length ? `<table class="rtbl"><thead><tr><th>Applies to</th><th>ATK change</th><th>Note</th><th></th></tr></thead><tbody>${drows.map((e, i) => `<tr><td><select class="in" data-c="dir" data-n="${i}" data-k="t" id="dir-${i}-t">${dopt(e.t)}</select></td><td>${`<input class="n" type="number" step="any" value="${fx(e.atk)}" data-c="dir" data-n="${i}" data-k="atk" id="dir-${i}-atk">`} ATK</td><td><input class="note-in" value="${esc(e.note || "")}" data-c="dir" data-n="${i}" data-k="note" id="dir-${i}-note" maxlength="80" placeholder="Why (M4A1 rifles…)"></td><td><button class="icon-btn sm" data-a="dirDel" data-n="${i}" aria-label="Remove directive">${ico("x")}</button></td></tr>`).join("")}</tbody></table>` : `<p class="muted">No directives for ${esc(sideLbl(dside))}.</p>`}
    <div class="row-btns"><button class="btn sm" data-a="dirAdd">${ico("plus")} Add directive</button></div></section>`;
  return head("Rules &amp; formulas", "Switch any step on or off to match how the chairs run combat. Changes apply at once to the calculator, the cards and the charts, and are written to the activity log.") + (ROLE === "admin" ? `<div class="panel"><div class="panel-h"><div><h3>Topic</h3><p>The rules below belong to the topic you pick here. Each topic has its own formula.</p></div></div><div class="seg" role="group">${Object.values(TOPICS).map(T => `<button class="${S.topic === T.id ? "on" : ""}" data-a="topic" data-t="${T.id}" aria-pressed="${S.topic === T.id}">${esc(T.title)}</button>`).join("")}</div></div>` : "") + `
  <div class="panel summary-rule"><div class="eyebrow">Current method</div><p class="rule-sentence">${ruleSentence(R)}</p></div>
  <ol class="pipe">
    ${step(1, "Unit attack", null, "Each unit starts from the ATK on its card.", "")}
    ${step(2, "Strength penalty", "useStr", "Weakened units attack with less. Strength is HP left as a share of full HP.", strT)}
    ${step(3, "Combat modifier", "useMod", "Adds to or takes from ATK by strength tier (for booklets that use a modifier instead of a penalty).", modT)}
    ${step(4, "Damage formula", null, "Turns the total effective attack into damage. Pick a preset or write your own.", fbox)}
    ${step(5, "Results chart", "useChart", "Looks the damage up as a % of the defenders' HP and decides how much of it lands and what the attacker loses.", chartT)}
    ${step(6, "Spread and finish", null, "How the damage is shared between several defenders, and what happens at 0 HP.", fin)}
    ${step(7, "Trenches", null, "Each side digs frontline, support and backline trenches on the war map (Trenches tool). The chairs move troops into and between the trenches. A unit standing in a trench of its own side is dug in: it takes less damage when attacked.", `<div class="fgrid"><div class="fld span2"><label for="r-tcut">Trench protection</label><input id="r-tcut" class="n" type="number" min="0" max="100" step="5" value="${fx(num(R.trenchCut, 50))}" data-c="rnum" data-k="trenchCut"><small>% less damage taken by a unit in its side's trench (0 turns trenches off in combat).</small></div><div class="fld span2"><label for="r-tkm">Counts as in the trench within</label><input id="r-tkm" class="n" type="number" min="1" max="300" step="5" value="${fx(num(R.trenchKm, 10))}" data-c="rnum" data-k="trenchKm"><small>km of the trench line, measured from the unit's marker.</small></div></div>`)}
  </ol>
  ${dirs}
  ${hasCabs() ? cabTypesPanel(d) : ""}
  <section class="panel"><div class="panel-h"><div><h3>Sub classes${hasCabs() ? " · base stats" : ""}</h3><p>${hasCabs() ? "The base stats every country starts from (above, each country can have its own). " : ""}The kinds of unit in each class, with the stats used when you add units. ${bookletFor() ? "These are the chairs' Military Resources Booklet figures (A, D and M as ATK, HP and MOV)." : "<b>All are placeholders until your allocation and the chairs' booklet arrive.</b>"} Editing a sub class does not change units already added; press “Update units” to push the new stats to them.</p></div><button class="btn sm" data-a="typeAdd">${ico("plus")} Add sub class</button></div>
    <div class="tbl-wrap"><table class="tbl types"><thead><tr><th>Code</th><th>Name</th><th>Class</th><th class="r">ATK</th><th class="r">HP</th><th class="r">MOV</th><th class="r">RNG</th><th class="r">Units</th><th></th></tr></thead><tbody>${types}</tbody></table></div>
    <div class="row-btns"><button class="btn sm plain" data-a="typesReset">${bookletFor() ? "Restore booklet stats" : "Restore placeholder stats"}</button></div></section>
  <section class="panel"><div class="panel-h"><div><h3>Classes</h3><p>The parts of the armed forces (Army, Navy, Airforce, Marine). Their colours are used on cards and charts.</p></div><button class="btn sm" data-a="branchAdd">${ico("plus")} Add class</button></div>
    <div class="br-list">${d.branches.map(b => { const n = d.units.filter(u => u.branch === b.id).length; return `<div class="br-row"><input type="color" value="${esc(b.color)}" data-c="branch" data-id="${b.id}" data-k="color" aria-label="Colour of ${esc(b.name)}"><input class="in" value="${esc(b.name)}" data-c="branch" data-id="${b.id}" data-k="name" id="br-${b.id}" maxlength="30" aria-label="Class name"><span class="muted">${plural(n, "unit")}</span><button class="icon-btn sm" data-a="branchDel" data-id="${b.id}" ${n ? "disabled title=\"In use\"" : ""} aria-label="Delete class">${ico("trash")}</button></div>`; }).join("")}</div></section>`;
}
function trialText() {
  const R = D().rules, F = formula(R), t = UI.tv, V = { atk: num(t.atk), base: num(t.atk), morale: R.useMorale ? num(t.morale) : 100, mult: 1, bonus: 0, hp: num(t.hp), maxhp: num(t.hp), n: 1, m: 1, datk: 0, str: 100 };
  let v; try { v = Math.max(0, (F.f || STD)(V)); } catch (e) { v = 0; }
  return `Try it: <b>${fx(v)}</b> damage = ${f1(pc(v, V.hp))}% of ${fx(V.hp)} HP`;
}

/* ---------- ALLOCATION & DATA ---------- */
function pgSettings() {
  const d = D(), T = TOPICS[S.topic];
  const sideF = s => `<div class="fld"><label for="sn-${s}">${s === "me" ? "Your side" : "The enemy"}</label><input id="sn-${s}" value="${esc(d.sides[s].name)}" data-c="sideName" data-s="${s}" maxlength="40"><div class="sug">${T.suggest.map(n => `<button data-a="sidePick" data-s="${s}" data-v="${esc(n)}">${esc(n)}</button>`).join("")}</div></div>`;
  const fronts = d.fronts.map((f, i) => { const n = d.units.filter(u => u.front === f.id).length; return `<div class="fr-row">${f.fixed ? `<span class="fixed">${esc(f.name)} <small>(fixed)</small></span>` : `<input class="in" value="${esc(f.name)}" data-c="frontName" data-f="${f.id}" id="fr-${f.id}" maxlength="40" aria-label="Front name">`}<small>${plural(n, "unit")}</small><span class="btns">${f.fixed ? "" : `<button class="icon-btn sm" data-a="frontMove" data-f="${f.id}" data-d="-1" ${i <= 1 ? "disabled" : ""} aria-label="Move up">${ico("up")}</button><button class="icon-btn sm" data-a="frontMove" data-f="${f.id}" data-d="1" ${i >= d.fronts.length - 2 ? "disabled" : ""} aria-label="Move down">${ico("down")}</button><button class="icon-btn sm" data-a="frontDel" data-f="${f.id}" aria-label="Delete front">${ico("trash")}</button>`}</span></div>`; }).join("");
  return head("Allocation &amp; data", "") + `
  <section class="set-grid">
    <div class="panel"><div class="panel-h"><div><h3>Allocation</h3><p>Fill this in when the chairs send allocations. The side names are used everywhere in the tracker.</p></div></div>
      <div class="fgrid"><div class="fld span2"><label for="al-del">Delegation / country</label><input id="al-del" value="${esc(d.alloc.delegation)}" data-c="alloc" data-k="delegation" maxlength="60" placeholder="Pending"></div><div class="fld span2"><label for="al-por">Portfolio / position</label><input id="al-por" value="${esc(d.alloc.portfolio)}" data-c="alloc" data-k="portfolio" maxlength="60" placeholder="e.g. Minister of War"></div></div>
      ${sideF("me")}${sideF("foe")}</div>
    <div class="panel"><div class="panel-h"><div><h3>Fronts</h3><p>The columns of the Order of Battle board. Reserve and Destroyed are fixed.</p></div><button class="btn sm" data-a="frontAdd">${ico("plus")} Add front</button></div>${fronts}</div>
    <div class="panel"><div class="panel-h"><div><h3>Backup &amp; data</h3><p>Everything is saved in this browser on this device after every change. Export a backup before the committee and to move to another device.</p></div></div>
      <div class="data-btns"><button class="btn primary" data-a="exp">${ico("down")} Export backup</button><button class="btn" data-a="imp" data-need="admin">${ico("up")} Import backup</button><button class="btn" data-a="sample">Load sample forces (demo)</button>${bookletFor() ? `<button class="btn" data-a="bookAllGo">Load booklet forces</button>` : ""}</div>
      <div class="data-btns"><button class="btn danger" data-a="clearForces" data-need="admin">Clear forces and history</button><button class="btn danger" data-a="resetTopic" data-need="admin">Reset everything in this topic</button></div>
      <p class="muted" style="font-size:12.5px">“Clear forces and history” keeps your allocation, rules, classes, sub classes and fronts. Both act on ${esc(topicLbl())} only, and Undo brings the data back.</p></div>
  </section>
  <section class="panel"><div class="panel-h"><div><h3>Activity log</h3><p>${plural(d.log.length, "entry", "entries")} for this topic, newest first</p></div><button class="btn sm danger" data-a="clearLog" data-need="admin">Clear log</button></div>${activity(400)}</section>` + accessPanel();
}

/* ---------- unit editor drawer ---------- */
function openDrawer(id) { if (!byId(id)) return; UI.drawer = id; renderDrawer(); const c = document.querySelector("#drawer .dr-h .icon-btn"); if (c) c.focus(); }
function closeDrawer() { const id = UI.drawer; UI.drawer = null; renderDrawer(); const c = id && document.querySelector(`.card[data-id="${id}"]`); if (c) c.focus(); }
function renderDrawer() { renderDrawerRaw(); lockForeign(); }
/* another chair's unit: its HP and front can change here (battles, damage), the rest stays as its owner set it */
function lockForeign() {
  const u = UI.drawer && byId(UI.drawer), h = $("drawer"); if (!foreign(u) || !h) return;
  h.querySelectorAll('[data-c="uf"]').forEach(el => { if (el.dataset.k !== "hp" && el.dataset.k !== "front") el.disabled = true; });
  h.querySelectorAll('[data-a="useTypeStats"],[data-a="uDel"]').forEach(b => { b.disabled = true; b.classList.add("locked"); b.title = "Only " + u.remote + " can change this"; });
  const f = h.querySelector(".dr-form"); if (f) f.insertAdjacentHTML("afterbegin", `<div class="lockbar" role="note"><b>${esc(u.remote)}'s unit.</b> You can change its HP and front and use it in battles. Only ${esc(u.remote)} can rename it, change its stats or remove it.</div>`);
}
function renderDrawerRaw() {
  const host = $("drawer"), u = UI.drawer ? byId(UI.drawer) : null;
  if (!u) { UI.drawer = null; host.classList.remove("on"); host.innerHTML = ""; return; }
  const d = D(), e = eff(u), s = strOf(u), t = tierOf(u);
  const fld = (k, l) => `<div class="fld"><label for="dr-${k}">${l}</label><input id="dr-${k}" type="number" min="0" step="0.5" value="${fx(u[k])}" data-c="uf" data-k="${k}"></div>`;
  host.innerHTML = `<div class="dr-back" data-a="closeDrawer"></div>
  <aside class="dr ${u.side}" role="dialog" aria-modal="true" aria-labelledby="drT">
    <header class="dr-h"><div><div class="eyebrow">${esc(sideLbl(u.side))}${u.side === "foe" ? " · enemy unit" : ""}</div><h2 id="drT">${esc(u.name)}</h2><div class="muted">${u.cab && cabById(u.cab) ? cabDot(u.cab) + esc(cabName(u.cab)) + " · " : ""}${esc(u.tname || "Custom unit")} · ${esc(branchById(u.branch).name)} · ${esc(frontName(u.front))}</div></div><button class="icon-btn" data-a="closeDrawer" aria-label="Close">${ico("x")}</button></header>
    <div class="dr-hp"><div class="dr-hp-top"><div><div class="eyebrow">Hit points</div><div class="dr-hp-v">${fx(u.hp)} <small>/ ${fx(u.maxhp)}</small></div></div><div class="dr-str tc-${t}">${lost(u) ? "Destroyed" : Math.round(s) + "%"}<small>${lost(u) ? "counts as lost" : "strength · " + TIER_L[t]}</small></div></div>
      <div class="hpbar lg"><i class="t-${t}" style="width:${s}%"></i></div>
      <div class="dr-hp-btns">${[-5, -1, 1, 5].map(v => `<button class="btn sm" data-a="hp" data-id="${u.id}" data-d="${v}">${v > 0 ? "+" : "−"}${Math.abs(v)} HP</button>`).join("")}<button class="btn sm" data-a="hpSet" data-id="${u.id}" data-v="full">Full HP</button><button class="btn sm danger" data-a="hpSet" data-id="${u.id}" data-v="0">Destroyed</button></div></div>
    <div class="dr-form"><div class="fgrid">
      <div class="fld span4"><label for="dr-name">Name</label><input id="dr-name" value="${esc(u.name)}" data-c="uf" data-k="name" maxlength="60"></div>
      <div class="fld span2" ${DEL ? "hidden" : ""}><label for="dr-side">Side</label><select id="dr-side" data-c="uf" data-k="side"><option value="me" ${u.side === "me" ? "selected" : ""}>${esc(sideLbl("me"))}</option><option value="foe" ${u.side === "foe" ? "selected" : ""}>${esc(sideLbl("foe"))}${ROLE === "chair" ? "" : " (enemy)"}</option><option value="ne" ${u.side === "ne" ? "selected" : ""}>Neutral</option></select></div>
      ${CABS().length ? `<div class="fld span2"><label for="dr-cab">Country</label><select id="dr-cab" data-c="uf" data-k="cab">${cabOpts(u.cab || "")}</select></div>` : ""}
      <div class="fld span2"><label for="dr-front">Front</label><select id="dr-front" data-c="uf" data-k="front">${frontOpts(u.front)}</select></div>
      <div class="fld span2"><label for="dr-type">Sub class</label><select id="dr-type" data-c="uf" data-k="type">${typeOpts(u.type)}<option value="" ${u.type ? "" : "selected"}>Custom unit</option></select></div>
      <div class="fld span2"><label for="dr-branch">Class</label><select id="dr-branch" data-c="uf" data-k="branch">${d.branches.map(b => `<option value="${b.id}" ${b.id === u.branch ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></div>
      ${fld("hp", "HP now")}${fld("maxhp", "Full HP")}${fld("atk", "Attack")}${fld("mov", "Movement")}${fld("rng", "Range")}
      <div class="fld span2 eff-box"><span class="lbl">Attack in combat</span><div><b>${fx(e.eff)}</b><span class="muted">${e.eff !== e.base ? `base ${fx(e.base)}${e.none ? ", too weak to attack" : e.pen ? `, ${sgn(e.pen)} strength penalty` : ""}${e.mod ? `, ${sgn(e.mod)} combat modifier` : ""}` : "no strength rule applies"}</span></div></div>
      ${u.type ? `<div class="fld span4"><button class="btn sm" data-a="useTypeStats" data-id="${u.id}">Reset stats to the ${esc(u.tname)} sub class</button></div>` : ""}
      <div class="fld span4"><label for="dr-notes">Notes</label><textarea id="dr-notes" rows="3" data-c="uf" data-k="notes" maxlength="1000" placeholder="Orders, commander, special abilities…">${esc(u.notes || "")}</textarea></div>
    </div></div>
    <footer class="dr-f"><button class="btn" data-a="uTray" data-id="${u.id}" data-w="att">${ico("swords")} Attack with it</button><button class="btn" data-a="uTray" data-id="${u.id}" data-w="def">Defend with it</button><span class="grow"></span><button class="btn" data-a="uDup" data-id="${u.id}">${ico("copy")} Duplicate</button><button class="btn danger" data-a="uDel" data-id="${u.id}">${ico("trash")} Remove</button></footer>
  </aside>`;
  host.classList.add("on");
}

/* ---------- modals ---------- */
function openModal(html) { const m = $("modal"); m.innerHTML = `<div class="m-back" data-a="modalClose"></div><div class="m" role="dialog" aria-modal="true">${html}</div>`; m.classList.add("on"); const f = m.querySelector("input:not([type=radio]),select"); if (f) f.focus(); }
function closeModal() { const m = $("modal"); m.classList.remove("on"); m.innerHTML = ""; UI.askCb = null; }
function askText(title, label, val, cb) {
  UI.askCb = cb;
  openModal(`<h2>${esc(title)}</h2><div class="fld" style="margin-top:14px"><label for="askIn">${esc(label)}</label><input id="askIn" value="${esc(val)}" maxlength="40"></div><div class="m-act"><button class="btn" data-a="modalClose">Cancel</button><button class="btn primary" data-a="askGo">Save</button></div>`);
  const i = $("askIn"); if (i) i.select();
}
function openAdd(front, side, typeId) {
  const d = D(), vc = viewCab(), cab0 = hasCabs() ? (vc && vc !== "_" && VIEW_PAGES.includes(UI.page) ? vc : vc === "_" && VIEW_PAGES.includes(UI.page) ? "" : (cabById(UI.lastCab) ? UI.lastCab : "")) : "";
  const tb = d.types.find(t => t.id === typeId) || d.types[0], t0 = typeFor(d, tb, cab0);
  if (side !== "me" && side !== "foe" && side !== "ne") side = UI.page === "map" ? (UI.mpSide || "me") : (UI.page === "board" && UI.boardSide === "foe") || ((UI.page === "roster" || UI.page === "forces") && UI.rosterSide === "foe") ? "foe" : "me";
  openModal(`<h2>Add units</h2><p class="muted">One card is made per unit. Stats come from the sub class${bookletFor() ? " (the chairs' booklet)" : " (placeholders until your allocation and the chairs' booklet arrive)"} and can be changed below.</p>
  <div class="fgrid">
    <div class="fld span4" ${DEL ? "hidden" : ""}><span class="lbl">Side</span><div class="radio-seg"><label><input type="radio" name="adSide" value="me" ${side === "me" ? "checked" : ""}>${esc(sideLbl("me"))}</label><label><input type="radio" name="adSide" value="foe" ${side === "foe" ? "checked" : ""}>${esc(sideLbl("foe"))}${ROLE === "chair" ? "" : " (enemy)"}</label><label><input type="radio" name="adSide" value="ne" ${side === "ne" ? "checked" : ""}>Neutral</label></div></div>
    ${CABS().length ? `<div class="fld span4"><label for="adCab">Country</label><select id="adCab" data-c="adCab">${cabOpts(cab0)}</select></div>` : ""}
    <div class="fld span2"><label for="adType">Sub class</label><select id="adType" data-c="adType">${typeOpts(tb ? tb.id : "")}<option value="">Custom unit</option></select></div>
    <div class="fld"><label for="adQty">How many</label><input id="adQty" type="number" min="1" max="60" step="1" value="1" data-i="adQty"></div>
    <div class="fld"><label for="adFront">Front</label><select id="adFront">${frontOpts(front && front !== "lost" ? front : "reserve", true)}</select></div>
    <div class="fld span4"><label for="adName">Name</label><input id="adName" value="${esc(t0 ? t0.name : "Unit")}" maxlength="50" data-i="adName"><small id="adHint"></small></div>
    <div class="fld"><label for="adAtk">Attack</label><input id="adAtk" type="number" min="0" step="0.5" value="${t0 ? fx(t0.atk) : 0}"></div>
    <div class="fld"><label for="adHp">Full HP</label><input id="adHp" type="number" min="0.5" step="0.5" value="${t0 ? fx(t0.hp) : 1}"></div>
    <div class="fld"><label for="adMov">Movement</label><input id="adMov" type="number" min="0" step="0.5" value="${t0 ? fx(t0.mov) : 0}"></div>
    <div class="fld"><label for="adRng">Range</label><input id="adRng" type="number" min="0" step="0.5" value="${t0 ? fx(t0.rng) : 0}"></div>
  </div>
  <div class="m-act"><button class="btn" data-a="modalClose">Cancel</button><button class="btn primary" data-a="addGo" id="adGo">Add 1 unit</button></div>`);
  addHint();
}
function addHint() {
  const q = clamp(Math.round(num($("adQty").value, 1)), 1, 60), b = $("adName").value.trim() || "Unit", n = nextNum(D(), b), exact = q === 1 && $("adName").dataset.t === "1";
  $("adGo").textContent = `Add ${plural(q, "unit")}`;
  $("adHint").textContent = exact ? `Named exactly “${b}”.` : `Numbered automatically: ${b} ${n}${q > 1 ? `, ${b} ${n + 1}${q > 2 ? ", …" : ""}` : ""}`;
}
function submitAdd() {
  const d = D(), side = (document.querySelector('input[name="adSide"]:checked') || {}).value || "me", t = d.types.find(x => x.id === $("adType").value);
  const q = clamp(Math.round(num($("adQty").value, 1)), 1, 60), front = $("adFront").value || "reserve", base = ($("adName").value.trim() || (t ? t.name : "Unit")).slice(0, 50), exact = q === 1 && $("adName").dataset.t === "1";
  const st = { atk: clamp(num($("adAtk").value), 0, STAT_MAX), maxhp: clamp(num($("adHp").value), 0, HP_MAX), mov: clamp(num($("adMov").value), 0, STAT_MAX), rng: clamp(num($("adRng").value), 0, STAT_MAX) };
  if (!(st.maxhp > 0)) { toast("Full HP must be more than 0"); $("adHp").focus(); return; }
  const cab = $("adCab") && cabById($("adCab").value) ? $("adCab").value : ""; UI.lastCab = cab;
  closeModal();
  act(`Added ${q} × ${base} (${cab ? cabName(cab) + ", " : ""}${sideLbl(side)}) to ${frontName(front)}`, dd => { let n = nextNum(dd, base); for (let i = 0; i < q; i++) dd.units.push(mkUnit(dd, { side, t, name: exact ? base : `${base} ${n++}`, front, hp: st.maxhp, cab, ...st })); }, "add");
  toast(`${plural(q, "unit")} added`);
}

/* ---------- demo forces ---------- */
function loadSample(quiet) {
  const P = TOPICS[S.topic].sample, step = 17 * 60000, t0 = Date.now() - (P.fights.length + 1) * step;
  act(null, d => {
    const fr = d.fronts.filter(f => f.id !== "lost");
    const add = (side, code, n, fi) => { const t = d.types.find(x => x.code === code); if (!t) return; const f = fr[Math.min(fi, fr.length - 1)]; let k = nextNum(d, t.name); for (let i = 0; i < n; i++) d.units.push(mkUnit(d, { side, t, name: `${t.name} ${k++}`, front: f.id })); };
    P.me.forEach(x => add("me", ...x)); P.foe.forEach(x => add("foe", ...x));
    if (d.sides.me.morale === 50) d.sides.me.morale = 65;
    if (d.sides.foe.morale === 50) d.sides.foe.morale = 55;
    addLog(d, "Sample forces loaded (demo data: use Clear forces and history to remove it)", "data"); d.log[0].t = t0;
    snap(d); d.hist[d.hist.length - 1].t = t0;
    P.fights.forEach(([aS, fi, na, nd], k) => {
      const f = fr[Math.min(fi, fr.length - 1)], A = d.units.filter(u => u.side === aS && u.front === f.id && !lost(u)).slice(0, na), B = d.units.filter(u => u.side === other(aS) && u.front === f.id && !lost(u)).slice(0, nd);
      const r = A.length && B.length ? resolve(A.map(u => u.id), B.map(u => u.id), { am: d.sides[aS].morale, dm: d.sides[other(aS)].morale, mult: 1, bonus: 0 }) : null;
      if (!r) return;
      const msg = battleMsg(r), t = t0 + (k + 1) * step;
      commitBattle(d, r).t = t; addLog(d, msg, "battle"); d.log[0].t = t; snap(d); d.hist[d.hist.length - 1].t = t;
    });
  }, "data");
  if (quiet !== true) toast("Sample forces loaded");
}
/* each cabinet's order of battle from its booklet (presets.js, topic 2): named units at the booklet's strength, in Reserve until deployed.
   A unit the booklet lists as "Not Found" (0%) is not raised yet, so it is left out rather than put on the books as already destroyed.
   A chair ticks the cabinets to load and the side each goes on. A unit the country already has (same name) is not added again. */
const BOOKS = () => TOPICS[S.topic].booklets || {};
const bookletFor = () => Object.keys(BOOKS()).length ? true : null;
const bookletBtn = () => bookletFor() ? `<button class="btn primary lg" data-a="bookAllGo" title="Every country's units from its booklet, at full strength, in Reserve">Load booklet forces</button><button class="btn lg" data-a="bookPick">Pick countries…</button>` : "";
/* one click: every cabinet's booklet units, each on its own side (the neutrals on the first side, as in the picker); units already there are skipped */
const preloadAll = () => loadBooklets(CABS().filter(c => BOOKS()[c.id]).map(c => [c.id, c.side === "foe" || c.side === "ne" ? c.side : "me"]));
function openBooklet() {
  const B = BOOKS(), d = D();
  const rows = CABS().filter(c => B[c.id]).map(c => {
    const bk = B[c.id], raised = bk.units.filter(u => u[2] > 0).length, have = d.units.filter(u => u.cab === c.id && !u.remote).length, def = c.side === "foe" || c.side === "ne" ? c.side : "me";
    return `<tr><td><input type="checkbox" id="bk-${c.id}" data-bk="${c.id}" ${have ? "" : "checked"}></td><td><label for="bk-${c.id}" class="bk-n">${cabDot(c.id)}<b>${esc(c.name)}</b>${c.side === "ne" ? '<span class="muted">neutral</span>' : ""}</label></td><td>${raised} of ${bk.units.length}</td><td>${have ? plural(have, "unit") : '<span class="muted">none yet</span>'}</td><td><select class="sel" id="bks-${c.id}" aria-label="Side for ${esc(c.name)}"><option value="me" ${def === "me" ? "selected" : ""}>${esc(sideLbl("me"))}</option><option value="foe" ${def === "foe" ? "selected" : ""}>${esc(sideLbl("foe"))}</option><option value="ne" ${def === "ne" ? "selected" : ""}>Neutral</option></select></td></tr>`;
  }).join("");
  openModal(`<h2>Load booklet forces</h2><p class="muted">Each country's units from its Military Resources Booklet, at full strength, in Reserve (awaiting deployment). A unit the country already has (same name) is not added twice. Spain, the USA and the Netherlands start Neutral; any cabinet can be put on another side here.</p>
  <div class="bk-wrap"><table class="rtbl full bk-t"><thead><tr><th><span class="vh-only">Load</span></th><th>Country</th><th>Units</th><th>You have</th><th>Side</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="m-act"><button class="btn plain" data-a="bookAll">Tick all</button><span class="grow"></span><button class="btn" data-a="modalClose">Cancel</button><button class="btn primary" data-a="bookGo">Load ticked countries</button></div>`);
}
/* picks: [[cabinet id, side]] */
function loadBooklets(picks) {
  const B = BOOKS(), d0 = D(); let n = 0, dup = 0, absent = 0; const done = [];
  picks.forEach(([cab, side]) => { const bk = B[cab]; if (!bk) return; let k = 0; bk.units.forEach(u => { if (!(u[2] > 0)) { absent++; return; } if (d0.units.some(x => x.cab === cab && !x.remote && x.name === u[1])) { dup++; return; } k++; }); n += k; if (k) done.push(`${cabName(cab)} (${k}, ${sideLbl(side)})`); });
  if (!n) { toast(dup ? "Those countries are already loaded" : "Nothing to load"); return; }
  act(`Booklet forces loaded: ${done.join(", ")}${absent ? `; ${absent} not found, not added` : ""}${dup ? `; ${dup} already there` : ""}`, d => {
    picks.forEach(([cab, side]) => {
      const bk = B[cab]; if (!bk) return; side = side === "foe" || side === "ne" ? side : "me";
      bk.units.forEach(([code, name, pct, cmd]) => {
        if (!(pct > 0) || d.units.some(x => x.cab === cab && !x.remote && x.name === name)) return;
        const t = d.types.find(x => x.code === code); if (!t) return;
        d.units.push(mkUnit(d, { side, t, name, front: "reserve", hp: r2(typeFor(d, t, cab).hp * pct / 100), cab, notes: cmd ? "Command authority: " + cmd : "" }));
      });
    });
  }, "data");
  toast(`${plural(n, "unit")} loaded`);
}
/* topics whose old demo data was dropped by the v2 conversion get the new demo instead */
function reseed() {
  const ks = S.reseed || []; delete S.reseed; if (!ks.length) return;
  const cur = S.topic; ks.forEach(k => { S.topic = k; loadSample(true); }); S.topic = cur; UNDO.length = 0; save();
}

/* ---------- import / export ---------- */
function exportJSON() {
  const blob = new Blob([JSON.stringify({ app: "hjcc-force-tracker", v: 1, exported: new Date().toISOString(), data: S }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sentinel-backup-${stamp()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  addLog(D(), "Backup exported", "data"); save(); render(); toast("Backup downloaded");
}
function importJSON(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      let o = JSON.parse(rd.result); if (o && o.data && o.data.topics) o = o.data;
      if (!o || !o.topics) throw new Error("not a tracker file");
      UNDO.push(JSON.stringify(S)); S = migrate(o); delete S.reseed; addLog(D(), `Backup imported: ${file.name}`, "data"); save();
      UI.sel = { att: [], def: [] }; UI.drawer = null; saveUI(); render(); toast("Backup imported. Undo brings back what you had.");
    } catch (e) { toast("That file is not a SENTINEL backup"); }
  };
  rd.readAsText(file);
}

/* ---------- theme: Day / Night ---------- */
const sysDark = () => !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
const themeNow = () => UI.theme === "light" || UI.theme === "dark" ? UI.theme : (sysDark() ? "dark" : "light");
function applyTheme() { if (UI.theme === "light" || UI.theme === "dark") document.documentElement.setAttribute("data-theme", UI.theme); else document.documentElement.removeAttribute("data-theme"); }

/* ---------- small UI helpers ---------- */
let toastT = 0;
function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600); }
/* ---------- smooth (Apple-style) collapse: animate the height in place, no page redraw ---------- */
const REDUCE = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
function animFold(panel, fold) {
  const body = panel.querySelector(":scope > .fold-body");
  if (!body || REDUCE) { panel.classList.toggle("folded", fold); return; }
  body.classList.add("anim");
  let ended = false;
  const done = () => { if (ended) return; ended = true; body.style.height = ""; body.classList.remove("anim"); body.removeEventListener("transitionend", onEnd); };
  const onEnd = e => { if (e.target === body && e.propertyName === "height") done(); };
  body.addEventListener("transitionend", onEnd);
  if (fold) {
    body.style.height = body.scrollHeight + "px"; void body.offsetHeight;
    panel.classList.add("folded"); body.style.height = "0px";
  } else {
    body.style.height = "0px"; panel.classList.remove("folded"); void body.offsetHeight;
    body.style.height = body.scrollHeight + "px";
  }
  setTimeout(done, 600);
}
function applyFold(k, f) {
  document.querySelectorAll('[data-a="fold"][data-k="' + k + '"]').forEach(h => {
    const panel = h.closest(".panel"); if (!panel) return;
    h.setAttribute("aria-expanded", String(!f)); h.title = f ? "Expand" : "Collapse";
    const p = h.querySelector("p[data-fsub]");
    if (p) { p.style.opacity = "0"; setTimeout(() => { p.innerHTML = f ? p.dataset.fsub : p.dataset.sub; p.style.opacity = ""; }, 140); }
    animFold(panel, f);
  });
}
function growIn(n) {
  n.classList.add("anim"); n.style.height = "0px"; n.style.opacity = "0"; void n.offsetHeight;
  n.style.height = n.scrollHeight + "px"; n.style.opacity = "1";
  setTimeout(() => { n.style.height = ""; n.style.opacity = ""; n.classList.remove("anim"); }, 460);
}
function shrinkOut(n, cb) {
  n.classList.add("anim"); n.style.height = n.scrollHeight + "px"; void n.offsetHeight;
  n.style.height = "0px"; n.style.opacity = "0"; setTimeout(cb, 360);
}

function arm(btn, fn) {
  if (btn.dataset.arm) { delete btn.dataset.arm; fn(); return; }
  btn.dataset.arm = "1"; btn.dataset.t = btn.innerHTML; btn.classList.add("armed"); btn.textContent = "Click again to confirm";
  setTimeout(() => { if (btn.isConnected && btn.dataset.arm) { delete btn.dataset.arm; btn.classList.remove("armed"); btn.innerHTML = btn.dataset.t; } }, 3000);
}
function syncMenu() { const b = document.querySelector(".menu-btn"); if (!b) return; const open = matchMedia("(max-width: 900px)").matches ? document.body.classList.contains("nav-open") : !document.body.classList.contains("side-off"); b.setAttribute("aria-expanded", open ? "true" : "false"); b.setAttribute("aria-label", open ? "Close menu" : "Open menu"); }
function go(p) { UI.page = p; UI.colMenu = null; document.body.classList.remove("nav-open"); saveUI(); render(); syncMenu(); window.scrollTo(0, 0); }   /* on desktop the side bar stays as the user left it; on phones the slide-in menu closes after a pick */

/* ======================= EVENTS ======================= */
const A = {
  go: el => go(el.dataset.p),
  signOut: () => SentinelAuth.signOut(),
  sdDay: el => { UI.sd = Number(el.dataset.d); saveUI(); render(); },
  sdPick: el => { sdPick = sdPick === el.dataset.id ? null : el.dataset.id; render(); },
  sdPut: el => { if (sdPick) sdMove(sdPick, el.dataset.s); },
  sdAdd: () => sdSend({ topic: S.topic, addDay: true }).then(() => { const d = SD[S.topic].days; UI.sd = d[d.length - 1].n; saveUI(); render(); }),
  sdDrop: () => { if (confirm("Remove the last day?")) sdSend({ topic: S.topic, dropDay: true }); },
  cpFill: el => { $("cp-u").value = el.dataset.u; $("cp-r").value = el.dataset.r; $("cp-p").focus(); },
  cpAdd: () => {
    const u = $("cp-u").value.trim().toLowerCase(), p = $("cp-p").value, role = $("cp-r").value;
    if (!u || !p) { toast("Enter a username and a password"); return; }
    SentinelAuth.api("POST", "/api/accounts", { u, p, role }).then(r => r.ok ? (toast("Saved " + u), loadAcc()) : r.json().then(j => toast(ACC_ERR[j.error] || "Could not save the account"), () => toast("Could not save the account")), () => toast("Could not reach the server"));
  },
  cpDel: el => {
    const u = el.dataset.u; if (!confirm("Remove the account " + u + "?")) return;
    SentinelAuth.api("DELETE", "/api/accounts", { u }).then(r => r.ok ? (toast("Removed " + u), loadAcc()) : r.json().then(j => toast(ACC_ERR[j.error] || "Could not remove it"), () => toast("Could not remove it")), () => toast("Could not reach the server"));
  },
  topic: el => { if (ROLE !== "admin" || S.topic === el.dataset.t) return; S.topic = el.dataset.t; UI.sel = { att: [], def: [] }; UI.cm = { att: null, def: null }; UI.drawer = null; UI.open = {}; save(); saveUI(); document.body.classList.remove("nav-open"); render(); toast(topicLbl()); },
  /* the battle map with the side menu closed, for the most map on screen (the menu button opens it again) */
  warMap: () => { document.body.classList.remove("nav-open"); document.body.classList.add("side-off"); try { localStorage.setItem("sentinel-side2", "off"); } catch (e) {} go("map"); },
  toCalc: () => go("combat"),
  menu: () => { if (matchMedia("(max-width: 900px)").matches) document.body.classList.toggle("nav-open"); else { const off = document.body.classList.toggle("side-off"); try { localStorage.setItem("sentinel-side2", off ? "off" : "on"); } catch (e) {} } syncMenu(); },
  undo: () => undo(),
  theme: el => { UI.theme = el.dataset.v; applyTheme(); saveUI(); chrome(); },
  addUnits: el => openAdd(el.dataset.f || "", el.dataset.s, el.dataset.t),
  subAdd: el => openSub(el.dataset.b, null),
  subEdit: el => openSub(null, el.dataset.id),
  subGo: el => submitSub(el.dataset.id),
  subDel: el => arm(el, () => { const t = D().types.find(x => x.id === el.dataset.id); if (!t) return; closeModal(); act(`Sub class removed: ${t.name} (its units stay, as custom units)`, d => { d.types = d.types.filter(x => x.id !== t.id); d.units.forEach(u => { if (u.type === t.id) u.type = ""; }); }, "rules"); }),
  mfOpen: el => {
    const k = el.dataset.k, was = !!UI.open[k]; if (was) delete UI.open[k]; else UI.open[k] = true; saveUI();
    const sub = el.closest(".mf-sub"), units = sub && sub.querySelector(".mf-units");
    if (REDUCE || (was && !units)) { render(); return; }
    if (sub) sub.classList.toggle("open", !was);
    if (was) { el.setAttribute("aria-expanded", "false"); shrinkOut(units, render); }
    else { render(); const t = document.getElementById("tg-" + k), sb = t && t.closest(".mf-sub"), n = sb && sb.querySelector(".mf-units"); if (n) growIn(n); }
  },
  mfAll: el => { const on = el.dataset.v === "1", d = D(); d.branches.forEach(b => { if (on) delete UI.fold["mf:" + b.id]; else UI.fold["mf:" + b.id] = true; }); d.types.forEach(t => { if (on) UI.open["mf:" + t.id] = true; else delete UI.open["mf:" + t.id]; }); saveUI(); render(); },
  sample: el => D().units.length ? arm(el, loadSample) : loadSample(),
  bookPick: () => openBooklet(),
  /* the country switch: a country's own side comes up with it (Overview and Forces show one side at a time) */
  cabPick: el => { const c = el.dataset.c; UI.cabF = c; if (c && c !== "_") { const sd = cabSide(c, S.topics[S.topic]); UI.ovSide = sd; UI.rosterSide = sd; if (UI.boardSide !== "both" && sd !== "ne") UI.boardSide = sd; } saveUI(); render(); },
  bookAllGo: () => preloadAll(),
  bookGo: () => { const picks = [...document.querySelectorAll("#modal input[data-bk]:checked")].map(i => [i.dataset.bk, ($("bks-" + i.dataset.bk) || {}).value]); if (!picks.length) { toast("Tick at least one country"); return; } closeModal(); loadBooklets(picks); },
  bookAll: () => { const b = [...document.querySelectorAll("#modal input[data-bk]")], all = b.every(i => i.checked); b.forEach(i => { i.checked = !all; }); },
  moraleStep: el => el.dataset.c ? setCabMorale(el.dataset.c, cabMorale(el.dataset.c) + num(el.dataset.d)) : setMorale(el.dataset.s, D().sides[el.dataset.s].morale + num(el.dataset.d)),
  ovSide: el => { UI.ovSide = el.dataset.s; saveUI(); render(); },
  ovMetric: el => { UI.ovMetric = el.dataset.m; saveUI(); render(); },
  boardSide: el => { UI.boardSide = el.dataset.s; UI.bs = 1; saveUI(); render(); },
  rosterSide: el => { UI.rosterSide = el.dataset.s; saveUI(); render(); },
  br: el => { UI.br = UI.br === el.dataset.b ? "" : el.dataset.b; saveUI(); render(); },
  hp: el => {
    const id = el.dataset.id, u = byId(id); if (!u) return;
    const old = num(u.hp), nv = clamp(r2(old + num(el.dataset.d)), 0, num(u.maxhp));
    if (nv === old) { toast(num(el.dataset.d) > 0 ? "Already at full HP" : "Already at 0 HP"); return; }
    act(null, d => {
      const x = d.units.find(y => y.id === id); setHp(d, x, nv);
      const L = d.log[0], tail = lost(x) ? " (destroyed)" : "";
      if (L && L.key === id && L.k === "hp" && Date.now() - L.t < 90000) { L.m = `${x.name}: HP ${fx(L.h0)} → ${fx(nv)}${tail}`; L.t = Date.now(); }   /* quick taps on −/+ become one log line */
      else { addLog(d, `${x.name}: HP ${fx(old)} → ${fx(nv)}${tail}`, "hp"); d.log[0].key = id; d.log[0].h0 = old; }
    }, "hp");
  },
  hpSet: el => { const u = byId(el.dataset.id); if (!u) return; const v = el.dataset.v === "full" ? u.maxhp : 0; if (v === u.hp) return; act(`${u.name}: HP ${fx(u.hp)} → ${fx(v)}${v ? " (full)" : " (destroyed)"}`, d => setHp(d, d.units.find(x => x.id === u.id), v), "hp"); },
  open: el => openDrawer(el.dataset.id),
  closeDrawer: () => closeDrawer(),
  tray: el => { const u = byId(el.dataset.id); if (u) toTray(u.id, u.side === UI.attSide ? "att" : "def"); },
  uTray: el => toTray(el.dataset.id, el.dataset.w),
  untray: el => { UI.sel[el.dataset.w] = UI.sel[el.dataset.w].filter(x => x !== el.dataset.id); saveUI(); render(); },
  colMenu: el => { UI.colMenu = UI.colMenu === el.dataset.f ? null : el.dataset.f; render(); },
  frontAdd: () => askText("Add a front", "Name of the front or theatre", "", v => act(`Front added: ${v}`, d => { d.fronts.splice(d.fronts.length - 1, 0, { id: uid("f"), name: v }); }, "edit")),
  frontRename: el => { const f = frontById(el.dataset.f); if (!f) return; UI.colMenu = null; askText("Rename front", "New name", f.name, v => { if (v !== f.name) act(`Front renamed: ${f.name} → ${v}`, d => { d.fronts.find(x => x.id === f.id).name = v; }, "edit"); }); },
  frontMove: el => { const id = el.dataset.f, dir = num(el.dataset.d); act(null, d => { const i = d.fronts.findIndex(x => x.id === id), j = i + dir; if (i < 0 || j < 1 || j > d.fronts.length - 2) return; const [f] = d.fronts.splice(i, 1); d.fronts.splice(j, 0, f); }); },
  frontDel: el => arm(el, () => { const id = el.dataset.f, f = frontById(id); if (!f) return; const n = D().units.filter(u => u.front === id).length; UI.colMenu = null; act(`Front removed: ${f.name}${n ? ` (${plural(n, "unit")} moved to Reserve)` : ""}`, d => { d.units.forEach(u => { if (u.front === id) u.front = "reserve"; }); d.fronts = d.fronts.filter(x => x.id !== id); }, "remove"); }),
  rtoggle: el => { const k = el.dataset.k; UI.open[k] = !UI.open[k]; saveUI(); render(); },
  fold: el => { const k = el.dataset.k, f = !UI.fold[k]; if (f) UI.fold[k] = true; else delete UI.fold[k]; saveUI(); applyFold(k, f); },
  foldAll: el => { const on = el.dataset.v === "1"; el.dataset.k.split(",").forEach(k => { if ((!!UI.fold[k]) === on) return; if (on) UI.fold[k] = true; else delete UI.fold[k]; applyFold(k, on); }); saveUI(); },
  swap: () => { UI.attSide = other(UI.attSide); const a = UI.sel.att; UI.sel.att = UI.sel.def; UI.sel.def = a; const c = UI.cm.att; UI.cm.att = UI.cm.def; UI.cm.def = c; saveUI(); render(); },
  clearSel: () => { UI.sel = { att: [], def: [] }; saveUI(); render(); },
  pickall: el => { const w = el.dataset.w, s = selNow(), side = w === "att" ? s.aS : s.dS, ids = D().units.filter(u => u.side === side && u.front === el.dataset.f && !lost(u)).sort(byOrd).map(u => u.id), all = ids.every(id => UI.sel[w].includes(id)); UI.sel[w] = all ? UI.sel[w].filter(x => !ids.includes(x)) : [...UI.sel[w], ...ids.filter(x => !UI.sel[w].includes(x))]; saveUI(); render(); },
  cmReset: el => { UI.cm[el.dataset.w] = null; saveUI(); render(); },
  artySet: el => { UI.arty = el.dataset.v === "safe"; saveUI(); render(); },
  multSet: el => { UI.mult = num(el.dataset.v, 1); saveUI(); render(); },
  apply: () => applyBattle(),
  rule: el => { const k = el.dataset.k, v = !D().rules[k]; act(`Rule changed: ${RULE_L[k]} switched ${v ? "on" : "off"}`, d => { d.rules[k] = v; }, "rules"); },
  preset: el => { const f = FORMULAS[el.dataset.f]; if (!f) return; act(`Damage formula set to “${f.name}”${f.morale ? "" : " (morale off)"}`, d => { d.rules.expr = f.expr; d.rules.useMorale = f.morale; }, "rules"); },
  rtAdd: el => { const t = el.dataset.t; act(`Rule table (${TBL_L[t === "strNo" ? "str" : t]}): row added`, d => { const R = d.rules; if (t === "str") R.str.push({ upTo: 90, atk: -1 }); else if (t === "strNo") R.str.push({ upTo: 10, noAtk: true, atk: 0 }); else if (t === "mod") R.mod.push({ min: 90, mod: 1 }); else { const c = chartSorted(R); R.chart.push({ min: c.length ? num(c[c.length - 1].min) + 25 : 0, tDmg: 100, aLoss: 0, note: "" }); } }, "rules"); },
  ruleSide: el => { UI.ruleSide = el.dataset.s; saveUI(); render(); },
  dirAdd: () => { const sd = UI.ruleSide === "foe" ? "foe" : "me"; act(`Directive added for ${sideLbl(sd)}`, d => { const R = d.rules; R.dir = R.dir || { me: [], foe: [] }; (R.dir[sd] = R.dir[sd] || []).push({ t: "*", atk: 1, note: "" }); }, "rules"); },
  dirDel: el => { const sd = UI.ruleSide === "foe" ? "foe" : "me", i = num(el.dataset.n); act(`Directive removed for ${sideLbl(sd)}`, d => { d.rules.dir[sd].splice(i, 1); }, "rules"); },
  rtDel: el => { const t = el.dataset.t, i = num(el.dataset.n); act(`Rule table (${TBL_L[t]}): row removed`, d => { d.rules[t].splice(i, 1); }, "rules"); },
  rtReset: el => { const t = el.dataset.t; act(`Rule table (${TBL_L[t]}) restored to default`, d => { d.rules[t] = defaultRules()[t]; }, "rules"); },
  typeAdd: () => act("Sub class added: NEW", d => { d.types.push({ id: uid("t"), code: "NEW", name: "New sub class", branch: d.branches[0].id, atk: 0, hp: 1, mov: 0, rng: 0, ph: false }); }, "rules"),
  typeDel: el => arm(el, () => { const t = D().types.find(x => x.id === el.dataset.id); if (!t) return; act(`Sub class removed: ${t.name} (its units keep their stats)`, d => { d.types = d.types.filter(x => x.id !== t.id); d.units.forEach(u => { if (u.type === t.id) u.type = ""; }); }, "rules"); }),
  typePush: el => { const t = D().types.find(x => x.id === el.dataset.id); if (!t) return; const c = el.dataset.cab || "", mine = u => u.type === t.id && !u.remote && (!c || u.cab === c), n = D().units.filter(mine).length;
    act(`${t.name}: ${c ? cabName(c) + "'s " : ""}sub class stats pushed to ${plural(n, "unit")}`, d => { d.units.forEach(u => { if (!mine(u)) return; const x = typeFor(d, t, u.cab), f = u.maxhp > 0 ? u.hp / u.maxhp : 1; u.atk = x.atk; u.mov = x.mov; u.rng = x.rng; u.maxhp = x.hp; u.hp = r2(x.hp * f); }); }, "rules"); },
  ruleCab: el => { UI.ruleCab = el.dataset.c; saveUI(); render(); },
  ctypeReset: el => { const c = el.dataset.cab, t = D().types.find(x => x.id === el.dataset.id); if (!t || !cabById(c)) return; act(`${cabName(c)}: ${t.name} back to the base stats`, d => { if (d.cabTypes && d.cabTypes[c]) delete d.cabTypes[c][t.id]; }, "rules"); },
  ctypeResetAll: el => { const c = el.dataset.cab; if (!cabById(c)) return; arm(el, () => act(`${cabName(c)}: every sub class back to the base stats`, d => { if (d.cabTypes) delete d.cabTypes[c]; }, "rules")); },
  typesReset: el => arm(el, () => act("Sub classes: placeholder stats restored", d => { TOPICS[S.topic].types.forEach(row => { const p = typeRow(row), t = d.types.find(x => x.code === p.code); if (t) Object.assign(t, { name: p.name, branch: p.branch, atk: p.atk, hp: p.hp, mov: p.mov, rng: p.rng, ph: true }); else d.types.push(p); }); }, "rules")),
  branchAdd: () => act("Class added", d => { d.branches.push({ id: uid("b"), name: "New class", color: "#5b616b" }); }, "rules"),
  branchDel: el => { const b = D().branches.find(x => x.id === el.dataset.id); if (!b || D().branches.length < 2) return; act(`Class removed: ${b.name}`, d => { d.branches = d.branches.filter(x => x.id !== b.id); }, "rules"); },
  sidePick: el => C.sideName({ dataset: { s: el.dataset.s }, value: el.dataset.v }),
  exp: () => exportJSON(),
  imp: () => ROLE === "admin" ? $("impFile").click() : deny(),
  cpReset: el => ROLE !== "admin" ? deny() : arm(el, () => SentinelAuth.api("POST", "/api/reset", { scope: el.dataset.s }).then(r => { if (!r.ok) throw new Error("reset"); toast("Reset done. Everyone's forces clear on their next load"); }).catch(() => toast("Could not reset"))),
  clearForces: el => ROLE !== "admin" ? deny() : arm(el, () => act(null, d => { d.units = []; d.battles = []; d.log = []; d.hist = []; addLog(d, "Forces, battles, history and log cleared", "data"); UI.sel = { att: [], def: [] }; }, "data")),
  resetTopic: el => ROLE !== "admin" ? deny() : arm(el, () => { act(null, () => { S.topics[S.topic] = newTopic(S.topic); addLog(S.topics[S.topic], "Topic reset to a fresh start", "data"); }, "data"); UI.sel = { att: [], def: [] }; saveUI(); }),
  clearLog: el => ROLE !== "admin" ? deny() : arm(el, () => act(null, d => { d.log = []; }, "data")),
  modalClose: () => closeModal(),
  askGo: () => { const v = ($("askIn").value || "").trim().slice(0, 40), cb = UI.askCb; if (!v) { $("askIn").focus(); return; } closeModal(); if (cb) cb(v); },
  addGo: () => submitAdd(),
  useTypeStats: el => { const u = byId(el.dataset.id), t = u && D().types.find(x => x.id === u.type); if (!t) return; if (foreign(u)) { denyForeign(u); return; } act(`${u.name}: stats reset to the ${t.name} sub class`, d => { const x = d.units.find(y => y.id === u.id), f = x.maxhp > 0 ? x.hp / x.maxhp : 1; Object.assign(x, { atk: t.atk, mov: t.mov, rng: t.rng, maxhp: t.hp, hp: r2(t.hp * f) }); }, "edit"); },
  uDup: el => { const u = byId(el.dataset.id); if (!u) return; const base = u.name.replace(/\s+\d+$/, ""); act(`Duplicated ${u.name}`, d => { const x = { ...u, id: uid("u"), name: `${base} ${nextNum(d, base)}`, ord: num(u.ord) + 0.5 }; delete x.remote; delete x.mirror; delete x.fsv; d.units.push(x); UI.drawer = x.id; }, "add"); },
  uDel: el => arm(el, () => { const u = byId(el.dataset.id); if (!u) return; if (foreign(u)) { denyForeign(u); return; } UI.drawer = null; UI.sel.att = UI.sel.att.filter(x => x !== u.id); UI.sel.def = UI.sel.def.filter(x => x !== u.id); act(`${u.name} removed from the roster`, d => { d.units = d.units.filter(x => x.id !== u.id); }, "remove"); })
};
const UF_L = { cab: "country", side: "side", front: "front", type: "sub class", branch: "class", hp: "HP", maxhp: "full HP", atk: "attack", mov: "movement", rng: "range" };
const C = {
  cpChar: el => {
    const u = el.dataset.u, t = el.dataset.t, ch = el.value || null;
    SentinelAuth.api("POST", "/api/allocation", { u, topic: t, char: ch }).then(r => r.ok ? (toast(ch ? "Character given to " + u : "Character cleared for " + u), loadAlloc()) : r.json().then(j => { toast(j.error === "taken" ? "Another account already has that character" : "Could not save the character"); loadAlloc(); }, () => toast("Could not save the character")), () => toast("Could not reach the server"));
  },
  imp: el => { const f = el.files && el.files[0]; el.value = ""; if (ROLE !== "admin") { deny(); return; } if (f) importJSON(f); },
  pick: el => { const w = el.dataset.w, id = el.dataset.id; if (el.checked) { if (!UI.sel[w].includes(id)) UI.sel[w].push(id); } else UI.sel[w] = UI.sel[w].filter(x => x !== id); saveUI(); render(); },
  cm: el => { UI.cm[el.dataset.w] = clamp(num(el.value, 50), 0, 100); saveUI(); render(); },
  mult: el => { UI.mult = Math.max(0, num(el.value, 1)); saveUI(); render(); },
  bonus: el => { UI.bonus = num(el.value, 0); saveUI(); render(); },
  ufront: el => { const u = byId(el.dataset.id), v = el.value; if (!u || u.front === v) return; act(`${u.name} moved: ${frontName(u.front)} → ${frontName(v)}`, d => moveTo(d, d.units.find(x => x.id === u.id), v), "move"); },
  uhp: el => { const u = byId(el.dataset.id); if (!u) return; const v = clamp(r2(num(el.value, u.hp)), 0, num(u.maxhp)); if (v === u.hp) { render(); return; } act(`${u.name}: HP ${fx(u.hp)} → ${fx(v)}${v > 0 ? "" : " (destroyed)"}`, d => setHp(d, d.units.find(x => x.id === u.id), v), "hp"); },
  uf: el => {
    const id = UI.drawer, u = byId(id); if (!u) return;
    const k = el.dataset.k; let v = el.value;
    if (foreign(u) && k !== "hp" && k !== "front") { denyForeign(u); renderDrawer(); return; }
    if (["hp", "maxhp", "atk", "mov", "rng"].includes(k)) v = clamp(r2(num(v, u[k])), 0, k === "hp" || k === "maxhp" ? HP_MAX : STAT_MAX);
    else if (k === "name") { v = v.trim().slice(0, 60); if (!v) { render(); return; } }
    if (k === "maxhp" && !(v > 0)) { toast("Full HP must be more than 0"); render(); return; }
    if (String(u[k] == null ? "" : u[k]) === String(v)) return;
    const show = x => k === "front" ? frontName(x) : k === "side" ? sideLbl(x) : k === "cab" ? (cabName(x) || "none") : k === "branch" ? branchById(x).name : k === "type" ? ((D().types.find(t => t.id === x) || {}).name || "Custom unit") : fx(x);
    const msg = k === "notes" ? null : k === "name" ? `Renamed: ${u.name} → ${v}` : `${u.name}: ${UF_L[k]} ${show(u[k])} → ${show(v)}`;
    act(msg, d => {
      const x = d.units.find(y => y.id === id); if (!x) return;
      if (k === "hp") setHp(d, x, v);
      else if (k === "maxhp") { x.maxhp = v; if (x.hp > v) setHp(d, x, v); }
      else if (k === "front") moveTo(d, x, v);
      else if (k === "type") { const t = d.types.find(y => y.id === v); x.type = v; if (t) { x.tcode = t.code; x.tname = t.name; x.branch = t.branch; } else { x.tcode = ""; x.tname = "Custom unit"; } }
      else if (k === "cab") x.cab = cabById(v) ? v : "";
      else if (k === "side") { x.side = v; UI.sel.att = UI.sel.att.filter(z => z !== id); UI.sel.def = UI.sel.def.filter(z => z !== id); }
      else x[k] = v;
    }, k === "front" ? "move" : k === "hp" ? "hp" : "edit");
  },
  rt: el => {
    const t = el.dataset.t, i = num(el.dataset.n), k = el.dataset.k, row = D().rules[t][i]; if (!row) return;
    let v = k === "note" ? el.value.trim().slice(0, 80) : num(el.value, row[k]);
    if (["upTo", "min", "tDmg", "aLoss"].includes(k)) v = Math.max(0, v);
    if (row[k] === v) return;
    act(`Rule table (${TBL_L[t]}): ${k === "note" ? "note" : `${row[k]} → ${v}`}`, d => { d.rules[t][i][k] = v; }, "rules");
  },
  dir: el => {
    const sd = UI.ruleSide === "foe" ? "foe" : "me", i = num(el.dataset.n), k = el.dataset.k, row = ((D().rules.dir || {})[sd] || [])[i]; if (!row) return;
    const v = k === "atk" ? num(el.value, row.atk) : k === "note" ? el.value.trim().slice(0, 80) : el.value; if (row[k] === v) return;
    act(`Directive for ${sideLbl(sd)}: ${k === "atk" ? `ATK ${sgn(row.atk)} → ${sgn(v)}` : k === "note" ? "note" : "target changed"}`, d => { d.rules.dir[sd][i][k] = v; }, "rules");
  },
  rnum: el => { const k = el.dataset.k, L = { deadCounter: ["Counter-attack of a destroyed defender", 0, 100, "%"], trenchCut: ["Trench protection", 0, 100, "% less damage"], trenchKm: ["Trench reach", 1, 300, " km"] }[k]; if (!L) return;
    const v = clamp(r2(num(el.value, D().rules[k])), L[1], L[2]); if (num(D().rules[k]) === v) { el.value = fx(v); return; } act(`Rule changed: ${L[0]} set to ${fx(v)}${L[3]}`, d => { d.rules[k] = v; }, "rules"); },
  rsel: el => { const k = el.dataset.k, v = el.value; if (D().rules[k] === v) return; act(`Rule changed: ${k === "spread" ? "damage spread" : "rounding"} set to ${k === "spread" ? SPREAD[v] : RND[v]}`, d => { d.rules[k] = v; }, "rules"); },
  expr: el => { const v = el.value.trim() || STD_EXPR, o = D().rules.expr; if (v === o) return; act(`Damage formula: ${o} → ${v}`, d => { d.rules.expr = v; }, "rules"); },
  ctype: el => {
    const c = el.dataset.cab, t = D().types.find(x => x.id === el.dataset.id), k = el.dataset.k; if (!t || !cabById(c) || !["atk", "hp", "mov", "rng"].includes(k)) return;
    const cur = typeFor(D(), t, c), v = Math.max(0, r2(num(el.value, cur[k]))); if (k === "hp" && !(v > 0)) { toast("HP must be more than 0"); render(); return; }
    if (cur[k] === v) return;
    act(`${cabName(c)}: ${t.code} ${k.toUpperCase()} ${fx(cur[k])} → ${fx(v)}`, d => { d.cabTypes = d.cabTypes || {}; const m = d.cabTypes[c] = d.cabTypes[c] || {}, o = m[t.id] = m[t.id] || {}; o[k] = v; if (["atk", "hp", "mov", "rng"].every(q => o[q] == null || o[q] === t[q])) delete m[t.id]; }, "rules");
  },
  type: el => {
    const t = D().types.find(x => x.id === el.dataset.id); if (!t) return; const k = el.dataset.k; let v = el.value;
    if (["atk", "hp", "mov", "rng"].includes(k)) v = Math.max(0, r2(num(v, t[k]))); else if (k === "code") v = v.trim().toUpperCase().slice(0, 8) || t.code; else if (k === "name") v = v.trim().slice(0, 40) || t.name;
    if (k === "hp" && !(v > 0)) { toast("HP must be more than 0"); render(); return; }
    if (t[k] === v) return;
    act(`Sub class ${t.code}: ${k === "branch" ? "class" : k} ${k === "branch" ? branchById(t[k]).name : t[k]} → ${k === "branch" ? branchById(v).name : v}`, d => { const x = d.types.find(y => y.id === t.id); x[k] = v; x.ph = false; d.units.forEach(u => { if (u.type !== x.id) return; if (k === "code") u.tcode = v; if (k === "name") u.tname = v; if (k === "branch") u.branch = v; }); }, "rules");
  },
  branch: el => { const b = D().branches.find(x => x.id === el.dataset.id); if (!b) return; const k = el.dataset.k, v = k === "color" ? el.value : (el.value.trim().slice(0, 30) || b.name); if (b[k] === v) return; act(k === "name" ? `Class renamed: ${b.name} → ${v}` : `Class colour changed: ${b.name}`, d => { d.branches.find(x => x.id === b.id)[k] = v; }, "rules"); },
  alloc: el => { const k = el.dataset.k, v = el.value.trim().slice(0, 60); if (D().alloc[k] === v) return; act(`Allocation: ${k === "delegation" ? "delegation" : "portfolio"} set to “${v || "pending"}”`, d => { d.alloc[k] = v; }, "edit"); },
  sideName: el => { const s = el.dataset.s, v = String(el.value).trim().slice(0, 40) || (s === "me" ? "My Force" : "Enemy Force"), o = D().sides[s].name; if (v === o) return; act(`Side renamed: ${o} → ${v}`, d => { d.sides[s].name = v; }, "edit"); },
  morale: el => el.dataset.cab ? setCabMorale(el.dataset.cab, el.value) : setMorale(el.dataset.s, el.value),
  frontName: el => { const f = frontById(el.dataset.f), v = el.value.trim().slice(0, 40); if (!f || !v || v === f.name) { render(); return; } act(`Front renamed: ${f.name} → ${v}`, d => { d.fronts.find(x => x.id === f.id).name = v; }, "edit"); },
  cabF: el => { UI.cabF = el.value; saveUI(); render(); },
  mapTurnOne: el => { if (el.value !== turnOf(S.topic).one) mpTurnSend("one:" + el.value); },
  adCab: () => { C.adType(); const c = cabById($("adCab").value); if (c) { const r = document.querySelector(`input[name="adSide"][value="${c.side}"]`); if (r) r.checked = true; } },
  adType: () => { const t = typeFor(D(), D().types.find(x => x.id === $("adType").value), $("adCab") ? $("adCab").value : ""); if (t) { $("adAtk").value = fx(t.atk); $("adHp").value = fx(t.hp); $("adMov").value = fx(t.mov); $("adRng").value = fx(t.rng); } if ($("adName").dataset.t !== "1") $("adName").value = t ? t.name : "Unit"; addHint(); }
};
const I = {
  q: el => { UI.q = el.value; render(); },
  pair: el => { const p = $(el.dataset.pair); if (p) p.value = el.value; },
  adQty: () => addHint(),
  adName: el => { el.dataset.t = "1"; addHint(); },
  exprLive: el => { let err = null, f = null; try { f = compile(el.value); } catch (e) { err = e.message; } const m = $("exprMsg"); m.className = "expr-msg " + (err ? "bad" : "ok"); m.textContent = err ? `Problem: ${err}` : "Formula is valid. Press Enter or click away to save it." + exprWarn(f); },
  tv: el => { UI.tv[el.dataset.k] = num(el.value); saveUI(); const o = $("trialOut"); if (o) o.innerHTML = trialText(); }
};

Object.assign(A, MAPA); Object.assign(C, MAPC); Object.assign(I, MAPI);
document.addEventListener("click", e => {
  if (UI.colMenu && !e.target.closest(".colmenu,[data-a=colMenu]")) { UI.colMenu = null; render(); }
  const el = e.target.closest("[data-a]");
  if (!el) { const c = !window.HJCCDnD && e.target.closest("#board .card[data-id]"); if (c) openDrawer(c.dataset.id); return; }   /* dnd.js opens cards itself */
  if (el.disabled) return;
  const f = A[el.dataset.a]; if (f) f(el, e);
});
document.addEventListener("change", e => { const el = e.target.closest("[data-c]"); if (el && C[el.dataset.c]) C[el.dataset.c](el, e); });
document.addEventListener("input", e => { const el = e.target.closest("[data-i]"); if (el && I[el.dataset.i]) I[el.dataset.i](el, e); });
document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches("details[data-k=steps]")) { UI.steps = e.target.open; saveUI(); } }, true);
document.addEventListener("keydown", e => {
  const t = e.target, typing = t.matches && t.matches("input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select");
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); undo(); return; }
  if (e.key === "Escape") { if ($("modal").classList.contains("on")) closeModal(); else if (UI.drawer) closeDrawer(); else if (UI.colMenu) { UI.colMenu = null; render(); } else { document.body.classList.remove("nav-open"); syncMenu(); } return; }
  if (e.key === "Enter" && t.closest && t.closest(".m") && t.matches("input:not([type=checkbox]):not([type=radio])")) { e.preventDefault(); const b = document.querySelector("#modal .m-act .btn.primary"); if (b) b.click(); return; }   /* Enter saves a pop-up form */
  if (e.key === "Enter" && t.id === "expr") { t.blur(); return; }
  if ((e.key === "Enter" || e.key === " ") && t.matches && t.matches("[role=button][data-a]")) { e.preventDefault(); t.click(); }
});
window.addEventListener("storage", e => { if (e.key === KEY && e.newValue && !dragging()) { try { S = migrate(JSON.parse(e.newValue)); render(); } catch (x) { /* ignore a half-written value */ } } });
if (window.matchMedia) { const mq = matchMedia("(prefers-color-scheme: dark)"); const f = () => chrome(); if (mq.addEventListener) mq.addEventListener("change", f); else if (mq.addListener) mq.addListener(f); }
setInterval(() => { if (UI.page === "overview" && !dragging() && !document.hidden && !document.querySelector("#page :focus")) render(); }, 60000);   /* keeps "x min ago" fresh */

if (window.HJCCDnD) HJCCDnD.init({
  board: "#board",
  onOpen: id => openDrawer(id),
  onMove: (id, front, ids) => moveUnit(id, front, ids),
  onZone: (id, zone) => toTray(id, zone === "def" ? "def" : "att"),
  onCancel: () => render()
});
try { localStorage.removeItem("sentinel-side"); if (localStorage.getItem("sentinel-side2") === "off") document.body.classList.add("side-off"); } catch (e) {}
syncMenu();
applyTheme();
reseed();
/* units loaded from a booklet before cabinets existed have no cabinet: give each the cabinet whose booklet names it, so it groups, hides and filters with the rest */
(function tagCabinets() {
  let ch = false;
  Object.keys(S.topics || {}).forEach(t => { const B = (TOPICS[t] && TOPICS[t].booklets) || {}, names = {}; Object.keys(B).forEach(c => B[c].units.forEach(u => { names[u[1]] = c; }));
    (S.topics[t].units || []).forEach(u => { if (!u.cab && !u.remote && names[u.name]) { u.cab = names[u.name]; ch = true; } }); });
  if (ch) save();
})();
render();
loadMorale(); setInterval(() => { if (!document.hidden) loadMorale(); }, 15000);
loadRules(); setInterval(() => { if (!document.hidden) loadRules(); }, 15000);
const beat = () => { if (!document.hidden) SentinelAuth.api("POST", "/api/status", { topic: S.topic, page: UI.page }).catch(() => {}); };
beat(); setInterval(beat, 45000);
setInterval(() => { if (UI.page === "status" && ROLE === "admin" && !document.hidden) loadStatus(); }, 5000);
document.addEventListener("dragstart", e => { const c = e.target.closest && e.target.closest(".sd-chip"); if (c) { e.dataTransfer.setData("text/plain", c.dataset.id); e.dataTransfer.effectAllowed = "move"; sdPick = c.dataset.id; } });
document.addEventListener("dragover", e => { if (e.target.closest && e.target.closest(".sd-col")) e.preventDefault(); });
document.addEventListener("drop", e => { const c = e.target.closest && e.target.closest(".sd-col"); if (!c) return; e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id && SD) sdMove(id, c.dataset.drop); });
