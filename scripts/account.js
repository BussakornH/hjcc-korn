"use strict";
/* node scripts/account.js <username> <password> <delegate|chair|admin>
   Creates the account or resets its password in the database. Reads DATABASE_URL from the
   environment or from .env.local (vercel env pull); with neither, it writes the local dev store in .data/. */
const fs = require("fs"), path = require("path");
for (const f of [".env.local", ".env"]) {
  try {
    fs.readFileSync(path.join(__dirname, "..", f), "utf8").split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    });
  } catch (e) {}
}
const L = require("../api/_lib");
const [u0, p, role] = process.argv.slice(2), u = String(u0 || "").trim().toLowerCase();
if (!/^[a-z0-9._-]{2,32}$/.test(u) || !p || !L.ROLES.includes(role)) {
  console.error("usage: node scripts/account.js <username> <password> <" + L.ROLES.join("|") + ">"); process.exit(1);
}
L.hashPassword(p).then((hash) => L.db.putAccount(u, { role, hash })).then(
  () => console.log("saved " + u + " (" + role + ") in " + (process.env.DATABASE_URL ? "the database" : ".data/store.json (local dev)")),
  (e) => { console.error(e.message); process.exit(1); }
);
