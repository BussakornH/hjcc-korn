"use strict";
/* Local stand-in for Vercel: serves this folder and runs api/*.js. Not deployed (vercel.json / .vercelignore skip it). */
const http = require("http"), fs = require("fs"), path = require("path");
const root = __dirname, port = +process.env.PORT || 5173;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".mp4": "video/mp4", ".ico": "image/x-icon" };

const vj = (() => { try { return JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")); } catch (e) { return {}; } })();
const sec = ((vj.headers || []).find((h) => h.source === "/(.*)") || { headers: [] }).headers;   /* same security headers as production */

http.createServer(async (req, res) => {
  sec.forEach((h) => res.setHeader(h.key, h.value));
  let url, p;
  try { url = new URL(req.url, "http://x"); p = decodeURIComponent(url.pathname); } catch (e) { res.statusCode = 400; return res.end("Bad request"); }
  if (p.startsWith("/api/")) {
    const name = p.slice(5);
    if (!/^[a-z]+$/.test(name) || !fs.existsSync(path.join(root, "api", name + ".js"))) { res.statusCode = 404; return res.end("{}"); }
    const f = require.resolve(path.join(root, "api", name + ".js"));
    Object.keys(require.cache).forEach((k) => { if (k.startsWith(path.join(root, "api"))) delete require.cache[k]; });
    try { return await require(f)(req, res); } catch (e) { console.error(e); if (!res.headersSent) { res.statusCode = 500; res.end("{}"); } return; }
  }
  let file = path.join(root, p === "/" ? "index.html" : p);
  const rel = path.relative(root, file);
  if (rel.startsWith("..") || /^(\.|api[\\/]|scripts[\\/]|package|dev-server|vercel)/.test(rel)) { res.statusCode = 404; return res.end("Not found"); }
  fs.readFile(file, (e, buf) => {
    if (e) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.end(buf);
  });
}).listen(port, () => console.log("sentinel dev server on http://localhost:" + port));
