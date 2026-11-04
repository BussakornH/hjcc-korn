"use strict";
const L = require("./_lib");

/* GET -> { rev }   (any signed-in role)
   rev is a tag that changes every time someone moves a unit on the battle order board (a delegate's forces) or on the map (the troops).
   A page polls this every couple of seconds, which is one tiny read, and fetches the full lists only when the tag has changed. */
module.exports = L.wrap(async (req, res) => {
  const me = await L.session(req);
  if (!me) return L.send(res, 401, { error: "auth" });
  if (req.method !== "GET") return L.send(res, 405, { error: "method" });
  L.send(res, 200, { rev: (await L.db.getKv("live:rev")) || "0" });
});
