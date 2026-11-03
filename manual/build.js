"use strict";
/* Builds manual/index.html (the Chair's Manual, 50 A4 pages) from the page definitions in manual/src/.
   Run:  node manual/build.js
   PDF:  node manual/pdf.js   (needs Playwright; prints index.html to manual/sentinel-chair-manual.pdf) */
const fs = require("fs"), path = require("path");
const { esc, plain } = require("./src/lib");
const css = fs.readFileSync(path.join(__dirname, "src/style.css"), "utf8");
const VERSION = "Version 1.0", DATE = "November 2026", TITLE = "SENTINEL Chair's Manual";
const content = [].concat(...["p1", "p2", "p3", "p4", "p5"].map(f => require("./src/" + f)));
const TOTAL = content.length + 2;

const MARK = '<svg viewBox="0 0 120 70" aria-hidden="true"><use href="#mark"/></svg>';
const sprite = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="mark" viewBox="0 0 120 70"><rect x="0" y="0" width="34" height="13"/><rect x="43" y="0" width="34" height="13"/><rect x="86" y="0" width="34" height="13"/><rect x="0" y="19" width="56" height="13"/><rect x="62" y="19" width="58" height="13"/><rect x="0" y="38" width="34" height="13"/><rect x="40" y="38" width="40" height="13"/><rect x="86" y="38" width="34" height="13"/><rect x="0" y="57" width="58" height="13"/><rect x="64" y="57" width="56" height="13"/></symbol></svg>';

const num = {}; content.forEach((p, i) => { p.n = i + 3; num[p.id] = p.n; });
const fill = h => h.replace(/\[\[([\w-]+)\]\]/g, '<a href="#p-$1">page {{p:$1}}</a>').replace(/\{\{p:([\w-]+)\}\}/g, (m, id) => { if (!(id in num)) throw new Error("unknown page id " + id); return num[id]; });
const run = (n, part) => `<header class="run"><span class="l">${MARK}<span>${TITLE}</span></span><span>${esc(part || "")}</span></header><footer class="run"><span>${VERSION} · ${DATE}</span><span class="n">${n}</span></footer>`;

const cover = `<section class="page cover" id="p-cover"><div class="bg"></div><div class="in">
  <svg class="mark" viewBox="0 0 120 70" aria-hidden="true"><use href="#mark"/></svg>
  <div class="kicker">SENTINEL Joint Operations Center</div>
  <h1>The Chair’s Manual</h1>
  <p class="sub">Run your committee from the first sign-in to the last battle: forces, morale, the battle map, combat and the rules.</p>
  <div class="shot"><img src="img/map-placed.jpg" alt="The Battle Map with troops placed on both sides"></div>
  <div class="ver">${VERSION} · ${DATE} · Historical Joint Crisis Committee</div></div></section>`;

const parts = []; content.forEach(p => { let g = parts.find(x => x.name === p.part); if (!g) parts.push(g = { name: p.part, items: [] }); g.items.push(p); });
const toc = `<section class="page" id="p-contents">${run(2, "Contents")}<div class="page-body"><div><div class="eyebrow">Inside</div><h1>Contents</h1></div>
  <div class="toc">${parts.map(g => `<div class="pt"><h3>${esc(g.name)}</h3>${g.items.map(p => `<a href="#p-${p.id}"><span class="d">${plain(p.title)}</span><span class="n">${p.n}</span></a>`).join("")}</div>`).join("")}</div></div></section>`;

const pages = content.map(p => `<section class="page${p.cls ? " " + p.cls : ""}" id="p-${p.id}">${run(p.n, p.part)}<div class="page-body"><div><div class="eyebrow">${esc(p.part)}</div><h1>${p.title}</h1>${p.lead ? `<p class="lead">${p.lead}</p>` : ""}</div>${p.body}</div></section>`);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
<meta name="description" content="A ${TOTAL}-page guide for chairs of the Historical Joint Crisis Committee: signing in, forces, morale, the battle map, the combat calculator, rules and sides by day.">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#fbfbfd">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>${css}</style>
</head>
<body>
${sprite}
<nav class="bar" aria-label="Manual"><b>${MARK}${TITLE}</b><a href="#p-contents">Contents</a><span class="sp"></span><a class="open" href="../app.html">Open SENTINEL</a><a class="cta" href="sentinel-chair-manual.pdf" download>Download PDF</a></nav>
<main class="sheet">
${cover}
${fill(toc)}
${fill(pages.join("\n"))}
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, "index.html"), html);
console.log(TOTAL + " pages written to manual/index.html (" + Math.round(html.length / 1024) + " KB)");
