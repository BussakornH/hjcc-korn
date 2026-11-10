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
Forty wrong passwords from one address (a whole room can share one wifi address, so this is generous), or ten against one account from one address, lock sign-in for that address for 15 minutes.
Sixty wrong passwords against one account from all addresses combined lock that account for 15 minutes (a brute-force ceiling).
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
The Chair's Manual (A4 sheets, no page limit) comes in three looks, each as a web page and a PDF. The home page footer links to the first.

| Style | Page | PDF |
|---|---|---|
| Clean (bright, Apple-like) | `manual/index.html` | `manual/sentinel-chair-manual.pdf` |
| Field Manual (cream paper, serif, olive and rust) | `manual/field.html` | `manual/sentinel-chair-manual-field.pdf` |
| Night Ops (dark console) | `manual/night.html` | `manual/sentinel-chair-manual-night.pdf` |

A switcher in the manual's top bar moves between the styles. All three are built from the same text in `manual/src/` (`p1.js` to `p6.js`, helpers in `lib.js`, shared layout in `base.css`, one theme file per style, screenshots in `manual/img/`, self-hosted fonts in `manual/fonts/`).
```
node manual/build.js [clean|field|night]   # writes the pages; flows each topic onto as many A4 sheets as it needs
node manual/pdf.js   [clean|field|night]   # prints the PDFs; --check only reports sheets that are too full
```
Both need Playwright (`npm i -D playwright`, then `npx playwright install chromium`): the build measures every block in headless Chromium so a topic that outgrows one sheet carries on to the next, and figures shrink a little first when that saves a near-empty sheet. The build also stops on an unknown cross-reference (`[[page-id]]`). To add a topic, add an entry to one of the `p*.js` files (a new part name goes into `PARTS_ORDER` in `build.js`); to restyle, edit the theme CSS.

The screenshots were taken from the running app (`npm run dev`) signed in as a chair. The Battle Map set (chair bar, weak and fortified points, lines, cities, troops) was retaken for version 2.0; the other screens are from version 1.0, so retake them when a screen changes.
