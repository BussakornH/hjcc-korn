"use strict";
/* Prints manual/index.html to manual/sentinel-chair-manual.pdf (A4, one manual page per sheet).
   Needs Playwright (npm i -D playwright or a global install). Run: node manual/pdf.js [--check] */
const path = require("path"), fs = require("fs");
const { chromium } = require("playwright");
const file = "file://" + path.join(__dirname, "index.html");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1000, height: 1400 } });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());   /* Inter is installed locally; do not wait on the network */
  await p.goto(file, { waitUntil: "load" });
  await p.evaluate(async () => { const im = [...document.images]; im.forEach(i => { i.loading = "eager"; }); await document.fonts.ready; await Promise.all(im.map(i => i.decode().catch(() => {}))); });
  /* a page is too full when its last block gets closer than ~3 mm to the footer rule (or spills out of the page) */
  const bad = await p.evaluate(() => [...document.querySelectorAll(".page")].map((el, i) => {
    const f = el.querySelector("footer.run"), b = el.querySelector(".page-body");
    if (!f || !b) return { n: i + 1, over: 0 };
    const last = [...b.children].pop(), bottom = Math.max(last.getBoundingClientRect().bottom, el.scrollHeight ? 0 : 0), gap = f.getBoundingClientRect().top - bottom;
    return { n: i + 1, over: Math.round(11 - gap) };
  }).filter(x => x.over > 0 && x.n > 1));
  const total = await p.evaluate(() => document.querySelectorAll(".page").length);
  console.log("pages:", total, "| overflowing:", bad.length ? JSON.stringify(bad) : "none");
  if (!process.argv.includes("--check")) {
    await p.pdf({ path: path.join(__dirname, "sentinel-chair-manual.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, displayHeaderFooter: false });
    console.log("pdf written", Math.round(fs.statSync(path.join(__dirname, "sentinel-chair-manual.pdf")).size / 1024) + " KB");
  }
  await b.close();
})();
