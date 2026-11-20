/* ---------- sign-in form ---------- */
(function () {
  var f = document.getElementById("f"), u = document.getElementById("u"), p = document.getElementById("p"),
      err = document.getElementById("err"), uf = document.getElementById("uf"), go = document.getElementById("go"), show = document.getElementById("show"),
      rem = document.getElementById("rem"), RK = "sentinel-remember";
  try { var r = localStorage.getItem(RK); if (r) { u.value = r; rem.checked = true; p.focus(); } else if (localStorage.getItem("sentinel-role") === "admin") p.focus(); else u.focus(); } catch (e) { u.focus(); }
  /* access level switcher: Chair -> Admin -> Chair (delegates no longer sign in; the chairs run every force) */
  var ROLES = [
    { key: "chair", name: "Chair", title: "Chair Access", note: "Chair accounts run every force, the map, morale, sides and rules." },
    { key: "admin", name: "Admin", title: "Administrator", help: "Contact the system owner to reset the administrator password.", note: "Administrator accounts can do everything, including rules, data and accounts." }
  ], ri = 0, roleBtn = document.getElementById("role"), roleLbl = document.getElementById("roleLbl"), noteEl = document.getElementById("note"), titleEl = document.getElementById("t"), helpEl = document.getElementById("help"), pips = roleBtn.querySelectorAll(".pips i");
  try { var sr = localStorage.getItem("sentinel-role"); for (var q = 0; q < ROLES.length; q++) if (ROLES[q].key === sr) ri = q; } catch (e) {}
  function paintRole(animate) {
    var r = ROLES[ri];
    function apply() {
      roleLbl.textContent = r.name + " access"; noteEl.textContent = r.note; err.textContent = "";
      titleEl.textContent = r.title; uf.hidden = r.key === "admin"; invalid(false); helpEl.textContent = r.help || "Ask your committee admin to reset your account.";
      for (var i = 0; i < pips.length; i++) pips[i].className = i === ri ? "on" : "";
      roleBtn.setAttribute("aria-label", "Switch access level. Currently " + r.name.toLowerCase() + " access.");
      roleBtn.className = "foot role-" + r.key; roleLbl.classList.remove("out"); noteEl.classList.remove("out");
    }
    if (!animate) { apply(); return; }
    roleLbl.classList.add("out"); noteEl.classList.add("out"); titleEl.classList.add("out"); setTimeout(function () { apply(); titleEl.classList.remove("out"); }, 140);
  }
  roleBtn.addEventListener("click", function () {
    ri = (ri + 1) % ROLES.length; paintRole(true);
    try { localStorage.setItem("sentinel-role", ROLES[ri].key); } catch (e) {}
  });
  paintRole(false);
  try { if (sessionStorage.getItem("sentinel-ended")) { sessionStorage.removeItem("sentinel-ended"); err.textContent = "Your session ended. Sign in again."; } } catch (e) {}
  function lockHeight() {
    var body = document.querySelector(".card .body"), hid = uf.hidden, t = titleEl.textContent;
    body.style.minHeight = ""; uf.hidden = false; titleEl.textContent = "Sign in";
    var hh = body.offsetHeight; uf.hidden = hid; titleEl.textContent = t; body.style.minHeight = hh + "px";
  }
  lockHeight(); window.addEventListener("load", lockHeight); if (document.fonts && document.fonts.ready) document.fonts.ready.then(lockHeight);
  show.addEventListener("click", function () { var on = p.type === "password"; p.type = on ? "text" : "password"; show.textContent = on ? "Hide" : "Show"; show.setAttribute("aria-pressed", on ? "true" : "false"); show.setAttribute("aria-label", on ? "Hide password" : "Show password"); });
  /* errors point at the field that needs fixing; typing clears the mark */
  function invalid(user, pass) { u.setAttribute("aria-invalid", user ? "true" : "false"); p.setAttribute("aria-invalid", pass ? "true" : "false"); }
  u.addEventListener("input", function () { u.setAttribute("aria-invalid", "false"); });
  p.addEventListener("input", function () { p.setAttribute("aria-invalid", "false"); });
  document.getElementById("forgot").addEventListener("click", function () { var h = document.getElementById("help"); h.hidden = !h.hidden; });
  f.addEventListener("submit", function (e) {
    e.preventDefault(); err.textContent = ""; invalid(false, false);
    var isAdmin = ROLES[ri].key === "admin";
    if (isAdmin ? !p.value : (!u.value.trim() || !p.value)) { invalid(!isAdmin && !u.value.trim(), !p.value); (!isAdmin && !u.value.trim() ? u : p).focus(); err.textContent = isAdmin ? "Enter the administrator password." : "Enter your username and password."; return; }
    go.disabled = true; go.textContent = "Checking…";
    SentinelAuth.signIn(isAdmin ? "" : u.value, p.value, ROLES[ri].key).then(function (res) { return { res: res, name: u.value.trim().toLowerCase() }; }).then(function (o) {
      var res = o.res;
      if (res === "ok") {
        try { if (isAdmin) { /* nothing to remember */ } else if (rem.checked) localStorage.setItem(RK, o.name); else localStorage.removeItem(RK); } catch (e) {}
        try { sessionStorage.setItem("sentinel-enter", "1"); } catch (e) {}
        grant(isAdmin ? "Administrator" : o.name); return;
      }
      go.disabled = false; go.textContent = "Enter"; p.value = ""; p.focus();
      if (res !== "locked" && res !== "role") invalid(!isAdmin, true);
      if (res === "locked") { var m = Math.max(1, Math.ceil((SentinelAuth.retry || 900) / 60)); err.textContent = "Too many attempts. Try again in " + m + (m === 1 ? " minute." : " minutes."); return; }
      err.textContent = res === "role" ? "This account does not have " + ROLES[ri].name.toLowerCase() + " access. Switch the access level below." : isAdmin ? "That password is not right." : "That username or password is not right.";
    }).catch(function () { go.disabled = false; go.textContent = "Enter"; err.textContent = "Cannot reach the sign-in service. Try again."; });
  });
  /* sign-in sequence: card out, globe spins up, "access granted" steps, then the dashboard */
  function grant(name) {
    var quick = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quick) { location.replace("app.html"); return; }
    document.body.classList.add("granting");
    if (window.SentinelGlobe) window.SentinelGlobe.boost();
    document.getElementById("gwho").textContent = name;
    var g = document.getElementById("grant"); g.setAttribute("aria-hidden", "false");
    var items = document.querySelectorAll("#gsteps li");
    setTimeout(function () { g.classList.add("on"); }, 450);
    for (var i = 0; i < items.length; i++) (function (li, n) { setTimeout(function () { li.classList.add("done"); }, 1100 + n * 600); })(items[i], i);
    setTimeout(function () { document.body.classList.add("leaving"); }, 3100);
    setTimeout(function () { location.replace("app.html"); }, 3550);
  }
  var c = document.getElementById("clock"); function t() { c.textContent = "UTC " + new Date().toISOString().slice(11, 19); } t(); setInterval(t, 1000);
})();
