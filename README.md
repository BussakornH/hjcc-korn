# SENTINEL

Static site (`index.html` sign-in, `app.html` dashboard) plus four serverless functions in `api/`.
Passwords are verified on the server with scrypt; sessions are HttpOnly, signed cookies; accounts and
sign-in rate limits live in a Redis database. Nothing secret ships to the browser.

## Vercel setup (once)
1. Project → Storage → add an **Upstash Redis** store (Marketplace). It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
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
Eight wrong passwords from one address, or ten against one account, lock sign-in for 15 minutes.
The war-game state itself (forces, log, rules) is still stored in each browser's localStorage, not in the database.
