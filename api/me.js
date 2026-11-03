"use strict";
const L = require("./_lib");

/* GET -> 200 { u, role } for a valid session, otherwise 401 */
module.exports = L.wrap(async (req, res) => {
  const s = await L.session(req);
  if (!s) return L.send(res, 401, { error: "auth" });
  L.send(res, 200, s);
});
