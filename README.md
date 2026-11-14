# SENTINEL

Static site (`index.html` sign-in, `app.html` dashboard) plus serverless functions in `api/`.
Passwords are verified on the server with scrypt. A successful sign-in returns a signed bearer token that each browser tab keeps in
`sessionStorage` (it is **not** an HttpOnly cookie, so the site's CSP in `vercel.json` is what limits the damage of any future XSS).
The CSP allows scripts only from the site's own files (`script-src 'self'`): keep every script in a `.js` file and every click handler in
`data-a` / `addEventListener`, never an inline `<script>` block or an `onclick=` attribute, or the browser will refuse to run it.
A token is tied to the account's current password hash, so resetting a password, or deleting and recreating the account, ends its
sessions; it otherwise lasts 12 hours (there is no server-side logout list). Accounts, shared game state and sign-in rate limits live in
a Neon Postgres database. Nothing secret ships to the browser.

## Vercel setup (once)
1. Project → Storage → add a **Neon Postgres** database (Marketplace). It injects `DATABASE_URL`.
2. Project → Settings → Environment Variables: add `SESSION_SECRET` = a long random string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
3. `vercel env pull .env.local`, then create the accounts in the production database:
   ```
   npm run account -- admin <password> admin
   npm run account -- chair <password> chair
   npm run account -- delegate <password> delegate
   ```
   Run the same command again to reset a password. Passwords must be at least 10 characters; very common ones, a single repeated
   character, or one containing the username are refused (here and on the admin's Accounts page). Existing accounts keep working until their
   password is next changed.

## Local development
`npm run dev` serves the site and the API on http://localhost:5173 using a file store in `.data/` (git-ignored, not deployed).
Seed local accounts with the same `npm run account` command when no `.env.local` is present.
`DEV_DB_LATENCY=15 npm run dev` delays every local database call by up to 15 ms, like a network database does. Use it when testing anything
that edits shared state from two screens at once; without it the file store is too fast to show a race.

## Limits
Vercel's Hobby plan deploys at most 12 serverless functions, and every file in `api/` that does not start with `_` is one. There are 12 now:
to add a route, fold it into an existing file or put shared code in a `_` file, or the deployment fails to build.
Forty wrong passwords from one address (a whole room can share one wifi address, so this is generous), or ten against one account from one address, lock sign-in for that address for 15 minutes.
Sixty wrong passwords against one account from all addresses combined lock that account for 15 minutes (a brute-force ceiling), but only for
addresses the account has never signed in from: an address it has signed in from before is still let through (and still held to ten wrong guesses),
so strangers filling the ceiling from many addresses cannot keep the owner, or every administrator at once, out.
An IPv6 address is counted by its /64 network, so one connection cannot start a fresh count by changing address.
Off Vercel the caller's address is the socket address; set `TRUST_PROXY=1` only behind a proxy of your own that sets `X-Forwarded-For`.
Every attempt is counted before its password is checked and handed back if it was not a wrong guess, so sending guesses in parallel does
not get more of them checked. Sign-ins still being checked count too, so if more than ten tabs sign in to one account from one address in
the same instant a few are refused for a moment; the sign-in page tries once more after 1.5 seconds before it reports a lock.
The last administrator can be neither removed nor given a lower access level.
Each delegate's forces, log and sub class stats are still stored in that browser's localStorage, not in the database (the chairs see a copy of the forces).
The combat rules (formula, switches, tables, directives) are shared: an edit by the Admin or a chair is saved in the database and reaches every screen within 15 seconds.
The first time, a chair's device hands in the rules it already has; resetting a topic leaves its rules alone.
A unit's attack, movement and range stop at 1000 and its HP at 100000, here and on the server.
When a session ends (12 hours, or a password reset) the next thing the page asks the server for sends that tab back to sign-in.

## Editing at the same time
Shared state (troops on the map, sides by day, city sides) is written so that two people editing at once do not erase each other.
A delegate's HP change and a chair's save are applied on top of each other; two chairs saving the troop list from the same starting point
get a "stale" answer for the second one, and its page merges its own edits onto the newer list and saves again (`troops-merge.js`).
Where the same field of the same troop was changed by both, the chair's value wins. Rules are saved as a whole per topic: if two people change them
at the same moment the second is told the rules changed and gets the new ones to look at before trying again. Battle lines are still saved as a whole list,
so two chairs redrawing lines at the same moment can still overwrite each other.

## Chair's manual
`manual/index.html` is the Chair's Manual (50 A4 pages), linked from the home page footer; `manual/sentinel-chair-manual.pdf` is the same thing as a PDF. Both are built from `manual/src/` (page text in `p1.js` to `p5.js`, design in `style.css`, screenshots in `manual/img/`):
```
node manual/build.js     # writes manual/index.html and checks cross-references
node manual/pdf.js       # prints it to manual/sentinel-chair-manual.pdf (needs Playwright); --check only reports pages that are too full
```
The screenshots were taken from the running app (`npm run dev`) signed in as a chair. Retake them when a screen changes.
