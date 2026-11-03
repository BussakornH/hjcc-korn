/* Sign-in page: a tab that already has a session goes straight to the dashboard. (Kept out of the page so the CSP can refuse inline scripts.) */
SentinelAuth.check(function (me) { if (me) location.replace("app.html"); });
