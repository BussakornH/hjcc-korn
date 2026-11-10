"use strict";
/* Small HTML helpers for the manual's page definitions. */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plain = s => String(s).replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ");

/* image size, read from the JPEG header, so annotation marks can be placed in image percentages */
const fs = require("fs"), path = require("path");
const dims = name => {
  const b = fs.readFileSync(path.join(__dirname, "..", "img", name + ".jpg")); let i = 2;
  while (i < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }; i += 2 + b.readUInt16BE(i + 2); }
  throw new Error("no size for " + name);
};
/* fig("overview", "caption", { cls, h, win:[topPct,heightPct], marks:[[n, xPct, yPct]] }). Marks are always in percent of the WHOLE image;
   win shows only a horizontal band of it (top and height in percent) and the marks follow. h is a plain crop for figures without marks. */
const fig = (name, cap, o = {}) => {
  const d = dims(name), ar = d.h / d.w; let inner, style = "";
  const mk = (m, y) => `<span class="mk" style="left:${m[1]}%;top:${y}%">${m[0]}</span>`;
  if (o.win) {
    const [t, hh] = o.win;
    style = ` style="aspect-ratio:${(1 / (ar * hh / 100)).toFixed(4)}"`;
    inner = `<img class="win" src="img/${name}.jpg" alt="${esc(o.alt || plain(cap || name))}" style="top:${(-t / hh * 100).toFixed(3)}%;height:${(100 / hh * 100).toFixed(3)}%" decoding="async">` + (o.marks || []).map(m => mk(m, ((m[2] - t) / hh * 100).toFixed(2))).join("");
  } else {
    style = o.h ? ` style="height:calc(${o.h} * var(--fig,1))"` : "";
    inner = `<img src="img/${name}.jpg" alt="${esc(o.alt || plain(cap || name))}"${style} loading="lazy" decoding="async">` + (o.marks || []).map(m => mk(m, m[2])).join("");
    style = "";
  }
  return `<figure class="fig ${o.cls || ""}"${o.w ? ` style="max-width:calc(${o.w} * var(--fig,1))"` : ""}><div class="fig-i${o.win ? " has-win" : ""}"${style}>${inner}</div>${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
};
const legend = items => `<ul class="legend">${items.map((t, i) => `<li><i>${i + 1}</i><span>${t}</span></li>`).join("")}</ul>`;
const co = (kind, title, text) => `<div class="co ${kind}"><div>${title ? `<b class="t">${title}</b>` : ""}${text}</div></div>`;
const tip = (t, x) => co("tip", t, x), note = (t, x) => co("note", t, x), warn = (t, x) => co("warn", t, x);
const steps = items => `<ol class="steps">${items.map(i => `<li>${Array.isArray(i) ? `<b class="h">${i[0]}</b>${i[1]}` : i}</li>`).join("")}</ol>`;
const tbl = (head, rows, cls = "") => `<table class="t ${cls}"><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const cd = (title, text, cls = "") => `<div class="cd ${cls}"><h3>${title}</h3>${text}</div>`;
const ui = t => `<span class="ui">${t}</span>`;
const kbd = t => `<kbd>${t}</kbd>`;
const cols = (n, items, extra = "") => `<div class="g${n}" ${extra}>${items.join("")}</div>`;
const Y = '<span class="y">●</span>', N = '<span class="no">–</span>';
const ref = id => `<a href="#p-${id}">page {{p:${id}}}</a>`;
module.exports = { esc, plain, fig, legend, co, tip, note, warn, steps, tbl, cd, ui, kbd, cols, Y, N, ref };
