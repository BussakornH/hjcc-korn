"use strict";
const os = require("os");
const L = require("./_lib");

/* POST { topic, page }  -> "I am here" heartbeat from any signed-in tab
   GET                   -> live status for the admin: who is online, database health, this function's memory */
const ACTIVE = 120;   /* seconds since the last heartbeat that still counts as online */
module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me) return L.send(res, 401, { error: "auth" });
  if (req.method === "POST") {
    if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
    const b = await L.readJson(req);
    await L.db.beat(me.u, me.role, String(b.topic || "").slice(0, 8), String(b.page || "").slice(0, 24));
    return L.send(res, 200, { ok: true });
  }
  if (me.role !== "admin") return L.send(res, 403, { error: "forbidden" });
  if (req.method !== "GET") return L.send(res, 405, { error: "method" });
  const t0 = process.hrtime.bigint(); await L.db.account(me.u); const latency = Number(process.hrtime.bigint() - t0) / 1e6;
  const [stats, online, accounts] = await Promise.all([L.db.stats(), L.db.seen(ACTIVE), L.db.accounts()]);
  const mu = process.memoryUsage(), cpu = process.cpuUsage();
  L.send(res, 200, {
    at: Date.now(), latency: Math.round(latency * 10) / 10, db: stats, online, accounts: Object.keys(accounts).length, window: ACTIVE,
    fn: { rss: mu.rss, heap: mu.heapUsed, heapTotal: mu.heapTotal, cpuMs: Math.round((cpu.user + cpu.system) / 1000), up: Math.round(process.uptime()), node: process.version, region: process.env.VERCEL_REGION || null, host: stats.kind === "file" ? { total: os.totalmem(), free: os.freemem(), load: os.loadavg()[0], cores: os.cpus().length } : null }
  });
});
