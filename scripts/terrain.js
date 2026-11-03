"use strict";
/* Builds terrain-data.json (real rivers and mountain ranges) from Natural Earth, public domain: https://www.naturalearthdata.com
   Usage: node scripts/terrain.js <ne_10m_rivers_lake_centerlines.geojson> <ne_10m_geography_regions_polys.geojson>
   Keeps what falls on the two maps (lon -12..49, lat 29..64), simplified, as [lat, lon] points. */
const fs = require("fs"), path = require("path");
const [rf, gf] = process.argv.slice(2);
if (!rf || !gf) { console.error("usage: node scripts/terrain.js rivers.geojson regions.geojson"); process.exit(1); }
const LON = [-12, 49], LAT = [29, 64];
const rd = f => JSON.parse(fs.readFileSync(f, "utf8"));
const inBox = pts => pts.some(p => p[0] >= LON[0] && p[0] <= LON[1] && p[1] >= LAT[0] && p[1] <= LAT[1]);
/* Douglas-Peucker */
function simp(p, tol) {
  if (p.length < 3) return p; const keep = new Uint8Array(p.length); keep[0] = keep[p.length - 1] = 1; const st = [[0, p.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let m = 0, k = -1;
    for (let i = a + 1; i < b; i++) { const dx = p[b][0] - p[a][0], dy = p[b][1] - p[a][1], l = dx * dx + dy * dy || 1e-12; let t = ((p[i][0] - p[a][0]) * dx + (p[i][1] - p[a][1]) * dy) / l; t = Math.max(0, Math.min(1, t)); const ex = p[a][0] + t * dx - p[i][0], ey = p[a][1] + t * dy - p[i][1], d = ex * ex + ey * ey; if (d > m) { m = d; k = i; } }
    if (k > 0 && m > tol * tol) { keep[k] = 1; st.push([a, k], [k, b]); }
  }
  return p.filter((_, i) => keep[i]);
}
const ll = p => [Math.round(p[1] * 100) / 100, Math.round(p[0] * 100) / 100];
const title = s => (s || "").toLowerCase().replace(/(^|[ '’-])(\S)/g, (_, a, b) => a + b.toUpperCase()).replace(/ (De|Du|Of|Del|Da)\b/g, x => x.toLowerCase());

const rivers = [];
rd(rf).features.forEach(f => {
  const pr = f.properties, rank = Number(pr.scalerank); if (rank > 6) return;
  const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [];
  lines.forEach(l => { if (!inBox(l)) return; const p = simp(l, 0.015).map(ll); if (p.length < 2) return; rivers.push({ n: pr.name_en || pr.name || "", w: rank <= 4 ? 2 : 1, p }); });
});
const ranges = [];
rd(gf).features.forEach(f => {
  const pr = f.properties; if (pr.FEATURECLA !== "Range/mtn") return;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
  polys.forEach(pl => { const ring = pl[0]; if (!inBox(ring)) return; const p = simp(ring, 0.04).map(ll); if (p.length < 4) return; ranges.push({ n: title(pr.NAME_EN || pr.NAME), p }); });
});
const out = path.join(__dirname, "..", "terrain-data.json");
fs.writeFileSync(out, JSON.stringify({ src: "Natural Earth (public domain)", rivers, ranges }));
console.log(rivers.length + " river parts, " + ranges.length + " ranges, " + (fs.statSync(out).size / 1024).toFixed(0) + " KB -> " + out);
