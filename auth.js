/* SENTINEL sign-in client. Passwords are checked on the server (/api/login) against the account database. Each browser
   tab keeps its own session token in sessionStorage, so a Delegate in one tab and the Administrator in another never
   affect each other. This file holds no credentials. */
(function () {
  var TK = "sentinel-token", cached;
  function token() { try { return sessionStorage.getItem(TK) || ""; } catch (e) { return ""; } }
  function head(h) { var t = token(); if (t) h.Authorization = "Bearer " + t; return h; }
  function call(method, url, body) { /* synchronous: pages need the role before they draw */
    try {
      var x = new XMLHttpRequest(); x.open(method, url, false);
      var h = head(body ? { "Content-Type": "application/json" } : {});
      for (var k in h) x.setRequestHeader(k, h[k]);
      x.send(body ? JSON.stringify(body) : null);
      return { status: x.status, json: (function () { try { return JSON.parse(x.responseText); } catch (e) { return null; } })() };
    } catch (e) { return { status: 0, json: null }; }
  }
  function me() {
    if (cached === undefined) {
      if (!token()) cached = null;
      else { var r = call("GET", "/api/me"); cached = r.status === 200 && r.json ? r.json : null; if (!cached) { try { sessionStorage.removeItem(TK); } catch (e) {} } }
    }
    return cached;
  }
  window.SentinelAuth = {
    roles: ["delegate", "chair", "admin"],
    user: function () { var s = me(); return s ? s.u : null; },
    role: function () { var s = me(); return s ? s.role : null; },
    require: function () { if (!me()) location.replace("./"); },
    /* administrator only: [{ u, role }] */
    list: function () { var r = call("GET", "/api/accounts"); return r.status === 200 && Array.isArray(r.json) ? r.json : []; },
    /* authenticated fetch for pages: SentinelAuth.api("DELETE", "/api/lines", { id }) */
    /* 401 means the session is gone (it ran out after 12 hours, or the password was reset): the tab goes back to sign-in with a note,
       instead of staying on a page where nothing saves. */
    api: function (method, url, body) {
      return fetch(url, { method: method, headers: head(body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined }).then(function (r) {
        if (r.status === 401 && token()) { try { sessionStorage.setItem("sentinel-ended", "1"); } catch (e) {} window.SentinelAuth.signOut(); }
        return r;
      });
    },
    /* async check for the sign-in page, so it never blocks painting */
    check: function (cb) { cb(me()); },
    /* resolves "ok" | "role" | "bad" | "locked" (SentinelAuth.retry = seconds). The administrator form passes no username.
       Sign-ins still being checked count against the limit too, so when many people sign in to one account from one wifi at the same moment
       a few can be refused; those are handed back within a second, so a refusal is tried once more before it is shown. */
    signIn: function (u, p, role, again) {
      return fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ u: u, p: p, role: role }) })
        .then(function (r) {
          if (r.status === 429 && !again) return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return window.SentinelAuth.signIn(u, p, role, true); });
          if (r.ok) return r.json().then(function (j) {
            try { sessionStorage.setItem(TK, j.token); sessionStorage.removeItem("sentinel-topic"); } catch (e) { return "bad"; }
            cached = undefined; return "ok";
          });
          if (r.status === 429) return r.json().then(function (j) { window.SentinelAuth.retry = j.retry; return "locked"; });
          if (r.status === 403) return "role";
          if (r.status === 400 || r.status === 401) return "bad";
          throw new Error("sign-in " + r.status);
        });
    },
    signOut: function () { try { sessionStorage.removeItem(TK); sessionStorage.removeItem("sentinel-topic"); } catch (e) {} location.replace("./"); }
  };
})();
