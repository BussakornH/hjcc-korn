# SENTINEL

Static site (`index.html` sign-in, `app.html` dashboard) plus serverless functions in `api/`.
Passwords are verified on the server with scrypt. A successful sign-in returns a signed bearer token that each browser tab keeps in
`sessionStorage` (it is **not** an HttpOnly cookie, so the site's CSP in `vercel.json` is what limits the damage of any future XSS).
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
   Run the same command again to reset a password.

## Local development
`npm run dev` serves the site and the API on http://localhost:5173 using a file store in `.data/` (git-ignored, not deployed).
Seed local accounts with the same `npm run account` command when no `.env.local` is present.

## Limits
Forty wrong passwords from one address (a whole room can share one wifi address, so this is generous), or ten against one account from one address, lock sign-in for that address for 15 minutes.
Sixty wrong passwords against one account from all addresses combined lock that account for 15 minutes (a brute-force ceiling).
The war-game state itself (forces, log, rules) is still stored in each browser's localStorage, not in the database.
