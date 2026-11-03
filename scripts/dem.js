"use strict";
/* Builds dem-t1.png and dem-t2.png (plus dem.json), the height of the ground under each map, from the open "Terrain Tiles" (Terrarium PNGs on AWS: SRTM, GMTED and other public elevation sources).
   Usage: node scripts/dem.js [cacheDir]      (tiles are kept in cacheDir so a re-run does not download them again)
   Each PNG is a grid of heights: metres + 32 in the red (high byte) and green (low byte) channels, sea is -1, rows from the north-west corner; dem.json gives each grid's size, west lon, north lat and step in degrees. */
const fs = require("fs"), path = require("path"), zlib = require("zlib"), https = require("https");
const MAPS = { t1: { lon: [-7, 10], lat: [41.5, 53], step: 0.008, z: 8 }, t2: { lon: [-11, 48], lat: [30, 63.5], step: 0.02, z: 7 } };
const cache = path.resolve(process.argv[2] || path.join(__dirname, "..", ".dem-cache")); fs.mkdirSync(cache, { recursive: true });
const get = url => new Promise((ok, no) => https.get(url, r => { if (r.statusCode !== 200) return no(new Error(url + " " + r.statusCode)); const b = []; r.on("data", c => b.push(c)); r.on("end", () => ok(Buffer.concat(b))); }).on("error", no));
const tx = (lon, N) => (lon + 180) / 360 * N, ty = (lat, N) => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * N;
/* a PNG reader for what the tiles are: 8-bit, not interlaced, RGB or RGBA */
function png(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len); if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (type === "IDAT") idat.push(d); p += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0; let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}
async function build(name, m) {
  const Z = m.z, N = 2 ** Z, [LON0, LON1] = m.lon, [LAT0, LAT1] = m.lat, STEP = m.step;
  const x0 = Math.floor(tx(LON0, N)), x1 = Math.floor(tx(LON1, N)), y0 = Math.floor(ty(LAT1, N)), y1 = Math.floor(ty(LAT0, N)), tiles = {}, todo = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) todo.push([x, y]);
  let n = 0; const next = async () => {
    for (let q; (q = todo.pop());) {
      const [x, y] = q, f = path.join(cache, Z + "-" + x + "-" + y + ".png"); let b;
      if (fs.existsSync(f)) b = fs.readFileSync(f); else { for (let t = 0; ; t++) { try { b = await get(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`); break; } catch (e) { if (t > 3) throw e; } } fs.writeFileSync(f, b); }
      tiles[x + "," + y] = png(b); ++n;
    }
  };
  const total = todo.length; await Promise.all(Array.from({ length: 8 }, next)); console.log(" of " + total);
  const elev = (px, py) => { const x = Math.floor(px), y = Math.floor(py), t = tiles[Math.floor(x / 256) + "," + Math.floor(y / 256)]; if (!t) return 0; const i = ((y % 256) * 256 + (x % 256)) * t.bpp; return t.px[i] * 256 + t.px[i + 1] + t.px[i + 2] / 256 - 32768; };
  const W = Math.round((LON1 - LON0) / STEP), H = Math.round((LAT1 - LAT0) / STEP), rows = Buffer.alloc(H * (W * 3 + 1));
  for (let j = 0; j < H; j++) {
    rows[j * (W * 3 + 1)] = 0;
    for (let i = 0; i < W; i++) {
      const lon = LON0 + (i + 0.5) * STEP, lat = LAT1 - (j + 0.5) * STEP, cx = tx(lon, N) * 256, cy = ty(lat, N) * 256; let s = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) s += elev(cx + a, cy + b);
      const e = Math.round(s / 9), v = (e < 1 ? -1 : Math.min(e, 6000)) + 32, o = j * (W * 3 + 1) + 1 + i * 3;   /* height + 32 in red and green; blue unused */
      rows[o] = v >> 8; rows[o + 1] = v & 255; rows[o + 2] = 0;
    }
  }
  const chunk = (t, d) => { const h = Buffer.alloc(8); h.writeUInt32BE(d.length, 0); h.write(t, 4, "ascii"); const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(Buffer.concat([h.subarray(4), d])) >>> 0, 0); return Buffer.concat([h, d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const file = path.join(__dirname, "..", "dem-" + name + ".png");
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
  META[name] = { w: W, h: H, lon0: LON0, lat1: LAT1, st: STEP };
  console.log(name + ": " + W + "x" + H + " grid, " + (fs.statSync(file).size / 1024).toFixed(0) + " KB -> " + file);
}
const META = {};
(async () => { for (const k of Object.keys(MAPS)) await build(k, MAPS[k]); fs.writeFileSync(path.join(__dirname, "..", "dem.json"), JSON.stringify(META)); })().catch(e => { console.error(e.message); process.exit(1); });
