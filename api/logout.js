"use strict";
const L = require("./_lib");

module.exports = L.wrap(async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, { error: "method" });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "origin" });
  L.send(res, 200, { ok: true }); /* tokens live in each tab; the client just drops its own */
});
