"use strict";
/* Prints the manual to PDF, one A4 sheet per page, in all three styles:
     index.html -> sentinel-chair-manual.pdf          (Clean)
     field.html -> sentinel-chair-manual-field.pdf    (Field Manual)
     night.html -> sentinel-chair-manual-night.pdf    (Night Ops)
   Run build.js first. Needs Playwright (npm i -D playwright, or a global install).
   Run: node manual/pdf.js [clean|field|night ...] [--check]    --check only tests the layout and writes no PDF */
const path = require("path"), fs = require("fs");
let pw; try { pw = require("playwright"); } catch (e) { pw = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")); }
const FILES = { clean: ["index.html", "sentinel-chair-manual.pdf"], field: ["field.html", "sentinel-chair-manual-field.pdf"], night: ["night.html", "sentinel-chair-manual-night.pdf"] };
(async () => {
  const want = process.argv.slice(2).filter(a => !a.startsWith("-")), keys = want.length ? want : Object.keys(FILES), check = process.argv.includes("--check");
  const b = await pw.chromium.launch(); let failed = false;
  for (const k of keys) {
    if (!FILES[k]) throw new Error("unknown style " + k);
    const [html, pdf] = FILES[k], p = await b.newPage({ viewport: { width: 1000, height: 1400 } });
    await p.route(/^https?:\/\//, r => r.abort());   /* fonts are in manual/fonts, nothing is fetched from the network */
    await p.goto("file://" + path.join(__dirname, html), { waitUntil: "load" });
    await p.evaluate(async () => { const im = [...document.images]; im.forEach(i => { i.loading = "eager"; }); await document.fonts.ready; await Promise.all(im.map(i => i.decode().catch(() => {}))); });
    /* a sheet is too full when its last block reaches past the bottom padding (17 mm) */
    const r = await p.evaluate(() => {
      const mm = 96 / 25.4, bad = [];
      document.querySelectorAll("section.page").forEach((el, i) => {
        if (el.classList.contains("cover")) return;
        const b = el.querySelector(".page-body"), lim = el.getBoundingClientRect().top + (297 - 17) * mm; let bottom = 0;
        b.querySelectorAll(":scope > *").forEach(c => { bottom = Math.max(bottom, c.getBoundingClientRect().bottom); });
        if (bottom > lim + 1 || b.scrollHeight > b.clientHeight + 1) bad.push({ n: i + 1, id: el.id, over: Math.round(bottom - lim) });
      });
      return { total: document.querySelectorAll("section.page").length, bad };
    });
    console.log(k.padEnd(6), "sheets:", r.total, "| overflowing:", r.bad.length ? JSON.stringify(r.bad) : "none");
    if (r.bad.length) failed = true;
    if (!check) {
      await p.pdf({ path: path.join(__dirname, pdf), format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, displayHeaderFooter: false });
      console.log("       ->", pdf, Math.round(fs.statSync(path.join(__dirname, pdf)).size / 1024) + " KB");
    }
    await p.close();
  }
  await b.close(); if (failed) process.exit(1);
})();
