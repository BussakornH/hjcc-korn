"use strict";
/* Builds the Chair's Manual in three styles from the page definitions in manual/src/.
     Clean         -> manual/index.html   (+ PDF sentinel-chair-manual.pdf)
     Field Manual  -> manual/field.html   (+ PDF sentinel-chair-manual-field.pdf)
     Night Ops     -> manual/night.html   (+ PDF sentinel-chair-manual-night.pdf)
   There is no page limit. Every topic starts on a fresh A4 sheet and its content flows onto as many sheets as it needs.
   Layout is measured in headless Chromium, so this needs Playwright (npm i -D playwright, or a global install).
   Run:  node manual/build.js            builds all three
         node manual/build.js clean      builds one (clean | field | night)
   PDFs: node manual/pdf.js */
const fs = require("fs"), path = require("path");
const { esc, plain } = require("./src/lib");
const S = f => fs.readFileSync(path.join(__dirname, "src", f), "utf8");

const VERSION = "Version 2.0", DATE = "November 2026", TITLE = "SENTINEL Chair's Manual";
const THEMES = [
  { key: "clean", name: "Clean", file: "index.html", pdf: "sentinel-chair-manual.pdf", color: "#fbfbfd" },
  { key: "field", name: "Field Manual", file: "field.html", pdf: "sentinel-chair-manual-field.pdf", color: "#2f3a1c" },
  { key: "night", name: "Night Ops", file: "night.html", pdf: "sentinel-chair-manual-night.pdf", color: "#0a0e15" }
];
/* the order the parts appear in; within a part the files' order stays */
const PARTS_ORDER = ["Introduction", "Welcome", "Getting started", "Overview", "Order of Battle", "Morale", "Battle Map", "Combat Calculator", "Rules & Formulas", "Sides by Day", "Playbook", "Reference"];
const all = [].concat(...["p1", "p2", "p3", "p4", "p5", "p6"].map(f => require("./src/" + f)));
all.forEach(p => { if (!PARTS_ORDER.includes(p.part)) throw new Error("unknown part " + p.part + " (add it to PARTS_ORDER)"); });
const content = all.map((p, i) => [p, i]).sort((a, b) => PARTS_ORDER.indexOf(a[0].part) - PARTS_ORDER.indexOf(b[0].part) || a[1] - b[1]).map(x => x[0]);
{ const seen = new Set(); content.forEach(p => { if (seen.has(p.id)) throw new Error("duplicate page id " + p.id); seen.add(p.id); }); }
const ids = new Set(content.map(p => p.id));

/* ---------- units of the page: 1 mm = 96/25.4 px ---------- */
const MM = 96 / 25.4, SHEET_H = 297, PAD_T = 19, PAD_B = 17, GAP = 2.5;
const CAP = (SHEET_H - PAD_T - PAD_B) * MM;            /* usable height of a sheet's body, px */
const BASE_SAFETY = 2 * MM;

const MARK = '<svg viewBox="0 0 120 70" aria-hidden="true"><use href="#mark"/></svg>';
const sprite = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="mark" viewBox="0 0 120 70"><rect x="0" y="0" width="34" height="13"/><rect x="43" y="0" width="34" height="13"/><rect x="86" y="0" width="34" height="13"/><rect x="0" y="19" width="54" height="13"/><rect x="63" y="19" width="57" height="13"/><rect x="0" y="38" width="34" height="13"/><rect x="43" y="38" width="34" height="13"/><rect x="86" y="38" width="34" height="13"/><rect x="0" y="57" width="54" height="13"/><rect x="63" y="57" width="57" height="13"/></symbol></svg>';

/* references: [[id]] -> link text "page N", {{p:id}} -> N. While measuring N is "00"; the final pass swaps in the real number. */
const refSpan = id => { if (!ids.has(id)) throw new Error("unknown page id " + id); return `<span data-ref="${id}">00</span>`; };
const prep = h => h.replace(/\[\[([\w-]+)\]\]/g, (m, id) => `<a href="#p-${id}">page ${refSpan(id)}</a>`).replace(/\{\{p:([\w-]+)\}\}/g, (m, id) => refSpan(id));
const realRefs = (h, num) => h.replace(/<span data-ref="([\w-]+)">00<\/span>/g, (m, id) => num[id]);

const run = (n, part) => `<header class="run"><span class="l">${MARK}<span>${TITLE}</span></span><span>${esc(part || "")}</span></header><footer class="run"><span>${VERSION} · ${DATE}</span><span class="n">${n}</span></footer>`;
const head = p => `<div><div class="eyebrow">${esc(p.part)}</div><h1>${p.title}</h1>${p.lead ? `<p class="lead">${p.lead}</p>` : ""}</div>`;
const contHead = p => `<div><div class="eyebrow">${esc(p.part)} · continued</div><div class="cont">${p.title}</div></div>`;
const sheet = (id, cls, n, part, inner, f) => `<section class="page${cls ? " " + cls : ""}" id="${id}"${f ? ` style="--fig:${f}"` : ""}>${run(n, part)}<div class="page-body">${inner}</div></section>`;

const tocGroup = (g, numOf, from = 0, to = g.items.length) => `<div class="pt"><h3>${esc(g.name)}${from ? " · continued" : ""}</h3>${g.items.slice(from, to).map(p => `<a href="#p-${p.id}"><span class="d">${plain(p.title)}</span><span class="n">${numOf(p)}</span></a>`).join("")}</div>`;
const groups = []; content.forEach(p => { let g = groups.find(x => x.name === p.part); if (!g) groups.push(g = { name: p.part, items: [] }); g.items.push(p); });

const cover = `<section class="page cover" id="p-cover"><div class="bg"></div><div class="stamp">Chair’s edition</div><div class="in">
  <svg class="mark" viewBox="0 0 120 70" aria-hidden="true"><use href="#mark"/></svg>
  <div class="kicker">SENTINEL Joint Operations Center</div>
  <h1>The Chair’s Manual</h1>
  <p class="sub">Run your committee from the first sign-in to the last battle: forces, morale, the battle map, combat, the rules and a playbook for the room.</p>
  <div class="shot"><img src="img/map-placed.jpg" alt="The Battle Map with troops placed on both sides"></div>
  <div class="ver">${VERSION} · ${DATE} · Historical Joint Crisis Committee</div></div></section>`;

/* ---------- headless measuring ---------- */
async function loadPlaywright() {
  try { return require("playwright"); } catch (e) {
    try { return require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")); }
    catch (e2) { throw new Error("Playwright is needed to measure the pages: run `npm i -D playwright` (and `npx playwright install chromium`), then try again."); }
  }
}
const docShell = (theme, body, extraCss = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${TITLE}</title>
<style>${S("fonts.css")}\n${S("base.css")}\n${S(theme.key + ".css")}\n${extraCss}</style></head><body>${sprite}${body}</body></html>`;

async function withPage(pw, fileName, html, fn) {
  const f = path.join(__dirname, fileName);
  fs.writeFileSync(f, html);
  const b = await pw.chromium.launch(), pg = await b.newPage({ viewport: { width: 1000, height: 1400 } });
  try {
    await pg.route(/^https?:\/\//, r => r.abort());
    await pg.goto("file://" + f, { waitUntil: "load" });
    await pg.evaluate(async () => { document.querySelectorAll("img").forEach(i => { i.loading = "eager"; }); await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
    return await fn(pg);
  } finally { await b.close(); fs.rmSync(f, { force: true }); }
}

/* heights of every top-level block of every page, as the theme lays them out (px) */
async function measure(pw, theme, jobs) {   /* jobs: [{ key, p, f }] with f = figure width factor */
  const mcss = ".page{height:auto!important;overflow:visible!important}.page-body{flex:none!important}.mx{display:flex;flex-direction:column;gap:" + GAP + "mm}.tocm{width:81mm}";
  const longest = content.reduce((a, b) => plain(b.title).length > plain(a.title).length ? b : a), parts0 = null;
  const parts = jobs.map(j => `<section class="page" data-id="${j.key}"${j.f !== 1 ? ` style="--fig:${j.f}"` : ""}><div class="page-body mx" data-m="1">${head(j.p)}${prep(j.p.body)}</div></section>`).join("");
  const extra = !jobs.some(j => j.key === "__toc") && jobs.length > 1 ? `<section class="page" data-id="__cont"><div class="page-body mx">${contHead(longest)}</div></section>` +
    `<section class="page" data-id="__tochead"><div class="page-body mx"><div><div class="eyebrow">Inside</div><h1>Contents</h1></div></div></section>` +
    `<section class="page" data-id="__toc"><div class="page-body"><div class="toc tocm" style="display:block">${groups.map(g => tocGroup(g, () => "00")).join("")}</div></div></section>` : "";
  return withPage(pw, ".measure-" + theme.key + ".html", docShell(theme, `<main class="sheet" style="padding:0;width:172mm;margin:0 auto">${parts}${extra}</main>`, mcss), pg => pg.evaluate(() => {
    const out = {};
    document.querySelectorAll("section.page").forEach(sec => {
      const id = sec.dataset.id;
      if (id === "__toc") { out[id] = [...sec.querySelectorAll(".pt")].map(e => { const h3 = e.querySelector("h3"), c = getComputedStyle(h3); return { hh: h3.getBoundingClientRect().height + parseFloat(c.marginBottom) + parseFloat(c.marginTop), mb: parseFloat(getComputedStyle(e).marginBottom), items: [...e.querySelectorAll("a")].map(a => a.getBoundingClientRect().height) }; }); return; }
      const body = sec.querySelector(".page-body");
      out[id] = [...body.children].map(c => { const cs = getComputedStyle(c); return { html: c.outerHTML, tag: c.tagName, h: c.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom) }; });
    });
    return out;
  }));
}

/* greedy flow: a heading never ends a sheet; a block taller than a sheet gets one to itself */
function flow(blocks, headH, contH, cap, gap) {
  const sheets = []; let cur = [0], used = headH;
  for (let i = 1; i < blocks.length; i++) {
    const add = gap + blocks[i].h;
    if (used + add <= cap || cur.length === 1) { cur.push(i); used += add; continue; }
    const last = cur[cur.length - 1];
    let carry = [];
    if (cur.length > 2 && blocks[last].tag === "H2") { cur.pop(); carry = [last]; }
    sheets.push(cur);
    cur = [-1].concat(carry, [i]); used = contH + carry.reduce((t, j) => t + gap + blocks[j].h, 0) + add;
    /* (-1 marks the continuation head) */
  }
  sheets.push(cur);
  return sheets;
}

function layout(m, extraSafety) {
  const cont = m.__cont[0].h, headToc = m.__tochead[0].h, pages = [];
  content.forEach(p => {
    const bl = m[p.id], safety = BASE_SAFETY + (extraSafety[p.id] || 0);
    pages.push({ p, bl, sheets: flow(bl, bl[0].h, cont, CAP - safety, GAP * MM) });
  });
  /* contents: two explicit columns per sheet; a group may carry on in the next column under "continued" */
  const g = m.__toc, colH = CAP - BASE_SAFETY - headToc - GAP * MM - (extraSafety.__toc || 0), tocSheets = [[[], []]];
  let ci = 0, used = 0;
  const nextCol = () => { ci++; used = 0; if (ci > 1) { tocSheets.push([[], []]); ci = 0; } };
  g.forEach((x, gi) => {
    let from = 0;
    while (from < x.items.length) {
      const left = x.items.length - from; let n = 0, h = x.hh;
      while (n < left && used + h + x.items[from + n] + (n + 1 === left ? x.mb : 0) <= colH) { h += x.items[from + n]; n++; }
      if (n < left && left - n === 1 && n > 2) { n--; }
      if (n === 0 || (n < left && n < 2)) { if (used === 0) n = Math.max(n, 1); else { nextCol(); continue; } }
      tocSheets[tocSheets.length - 1][ci].push({ gi, from, to: from + n });
      used += x.hh + x.items.slice(from, from + n).reduce((t, v) => t + v, 0) + (from + n === x.items.length ? x.mb : 0);
      from += n; if (from < x.items.length) nextCol();
    }
  });
  return { pages, tocSheets, scale: m.__scale || {} };
}

function assemble(theme, lay) {
  const nToc = lay.tocSheets.length; let n = 1 + nToc + 1; const num = {}, order = [];
  lay.pages.forEach(pg => { num[pg.p.id] = n; order.push({ pg, first: n }); n += pg.sheets.length; });
  const total = n - 1;
  const tocHtml = lay.tocSheets.map((cols, si) => {
    const inner = `<div>${si ? `<div class="eyebrow">Inside · continued</div><div class="cont">Contents</div>` : `<div class="eyebrow">Inside</div><h1>Contents</h1>`}</div><div class="toc">${cols.map(c => `<div>${c.map(k => tocGroup(groups[k.gi], p => num[p.id], k.from, k.to)).join("")}</div>`).join("")}</div>`;
    return sheet(si ? `p-contents-${si + 1}` : "p-contents", "", 2 + si, "Contents", inner);
  }).join("\n");
  const body = order.map(({ pg, first }) => pg.sheets.map((idxs, si) => {
    const inner = idxs.map(i => i === -1 ? contHead(pg.p) : pg.bl[i].html).join("");
    return sheet(si ? `p-${pg.p.id}-${si + 1}` : `p-${pg.p.id}`, pg.p.cls || "", first + si, pg.p.part, inner, lay.scale[pg.p.id]);
  }).join("\n")).join("\n");
  const switcher = `<span class="sw-st" role="group" aria-label="Style">${THEMES.map(t => `<a href="${t.file}"${t.key === theme.key ? ' aria-current="page"' : ""}>${t.name}</a>`).join("")}</span>`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}${theme.key === "clean" ? "" : " · " + theme.name}</title>
<meta name="description" content="A ${total}-sheet guide for chairs of the Historical Joint Crisis Committee: signing in, forces, morale, the battle map, weak and fortified ground, the combat calculator, rules, sides by day and a session playbook.">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="${theme.color}">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>${S("fonts.css")}\n${S("base.css")}\n${S(theme.key + ".css")}</style>
</head>
<body>
${sprite}
<nav class="bar" aria-label="Manual"><b>${MARK}<span class="hide-s">${TITLE}</span></b><a href="#p-contents">Contents</a><span class="sp"></span>${switcher}<a class="open hide-s" href="../app.html">Open SENTINEL</a><a class="cta" href="${theme.pdf}" download>PDF</a></nav>
<main class="sheet">
${cover}
${realRefs(tocHtml, num)}
${realRefs(body, num)}
</main>
</body>
</html>
`;
  return { html, num, total };
}

/* open the finished page, find sheets whose body spills past the footer, and report them */
async function verify(pw, theme, html) {
  return withPage(pw, ".verify-" + theme.key + ".html", html, pg => pg.evaluate((cfg) => {
    const bad = [];
    document.querySelectorAll("section.page").forEach((el, i) => {
      if (el.classList.contains("cover")) return;
      const b = el.querySelector(".page-body"), top = el.getBoundingClientRect().top, limit = top + (cfg.sheet - cfg.padB) * cfg.mm;
      let bottom = 0; [...b.querySelectorAll(":scope > *, :scope .toc > div")].forEach(c => { bottom = Math.max(bottom, c.getBoundingClientRect().bottom); });
      const over = Math.round(bottom - limit);
      if (over > 0 || b.scrollHeight > b.clientHeight + 1) bad.push({ n: i + 1, id: el.id, over });
    });
    return { count: document.querySelectorAll("section.page").length, bad };
  }, { sheet: SHEET_H, padB: PAD_B, mm: MM }));
}

async function measureAll(pw, theme) {
  const m = await measure(pw, theme, content.map(p => ({ key: p.id, p, f: 1 }))), scale = {};
  const cont = m.__cont[0].h, cap = CAP - BASE_SAFETY, total = bl => bl.reduce((t, b, i) => t + b.h + (i ? GAP * MM : 0), 0);
  /* a topic that spills only a little: shrink its figures until it fits one sheet */
  const tight = content.filter(p => { const t = total(m[p.id]); return t > cap && t <= cap * 1.45; });
  const FACTORS = [0.94, 0.88, 0.82, 0.76, 0.7, 0.64, 0.6];
  if (process.env.FITDEBUG) content.forEach(p => { const t = total(m[p.id]); if (t > cap * 0.97) console.log("  fit", p.id, (t / cap).toFixed(2)); });
  if (tight.length) {
    const m2 = await measure(pw, theme, [].concat(...tight.map(p => FACTORS.map(f => ({ key: p.id + "@" + f, p, f })))));
    tight.forEach(p => { const f = FACTORS.find(f => total(m2[p.id + "@" + f]) <= cap); if (f) { m[p.id] = m2[p.id + "@" + f]; scale[p.id] = f; } });
  }
  m.__scale = scale; return m;
}

async function buildTheme(pw, theme) {
  const m = await measureAll(pw, theme), extra = {}; let out;
  for (let pass = 0; pass < 6; pass++) {
    const lay = layout(m, extra); out = assemble(theme, lay);
    const v = await verify(pw, theme, out.html);
    if (!v.bad.length) { out.pass = pass; break; }
    v.bad.forEach(b => { const id = b.id.replace(/^p-/, "").replace(/-\d+$/, ""); const key = id === "contents" ? "__toc" : id; extra[key] = (extra[key] || 0) + Math.max(b.over, 4) + 4; });
    if (pass === 5) { out.problems = v.bad; }
  }
  fs.writeFileSync(path.join(__dirname, theme.file), out.html);
  const sheetsPer = {}; const ids2 = content.map(p => p.id);
  ids2.forEach((id, i) => { const next = ids2[i + 1], end = next ? out.num[next] : out.total + 1; sheetsPer[id] = end - out.num[id]; });
  const multi = Object.keys(sheetsPer).filter(k => sheetsPer[k] > 1);
  console.log(`${theme.name.padEnd(13)} ${String(out.total).padStart(3)} sheets · ${(Buffer.byteLength(out.html) / 1024) | 0} KB · ${theme.file}` + (multi.length ? ` · spills: ${multi.map(k => k + "×" + sheetsPer[k]).join(", ")}` : ""));
  if (out.problems) console.log("  STILL OVERFLOWING:", JSON.stringify(out.problems));
  return out;
}

(async () => {
  const want = process.argv.slice(2).filter(a => !a.startsWith("-")), pw = await loadPlaywright();
  const list = want.length ? THEMES.filter(t => want.includes(t.key)) : THEMES;
  if (!list.length) throw new Error("unknown style; use clean, field or night");
  for (const t of list) await buildTheme(pw, t);
})().catch(e => { console.error(e.message || e); process.exit(1); });
