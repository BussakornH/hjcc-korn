/* Topic picker: greeting, the two topic cards and their theatre maps. */
(function () {
  var u = SentinelAuth.user() || "", role = SentinelAuth.role() || "";
  document.getElementById("pt").textContent = "Welcome, " + (u ? u.charAt(0).toUpperCase() + u.slice(1) : "chair");
  document.getElementById("lvl").textContent = role === "admin" ? "Administrator access" : "Chair access";
  var cards = document.querySelectorAll(".pick-card");
  function enter(card) {
    try { sessionStorage.setItem("sentinel-topic", card.getAttribute("data-t")); sessionStorage.setItem("sentinel-enter", "1"); } catch (e) {}
    for (var j = 0; j < cards.length; j++) cards[j].classList.toggle("on", cards[j] === card);
    document.body.classList.add("leaving");
    setTimeout(function () { location.replace("app.html"); }, 380);
  }
  for (var i = 0; i < cards.length; i++) {
    cards[i].addEventListener("click", function (e) { enter(this); });
    var gb = cards[i].querySelector(".go"), nm = cards[i].querySelector("b");
    if (gb && nm) gb.setAttribute("aria-label", "Enter topic: " + nm.textContent);   /* two buttons with the same name are indistinguishable to a screen reader */
  }
  document.getElementById("out").addEventListener("click", function () { SentinelAuth.signOut(); });
  var c = document.getElementById("clock"); function t() { c.textContent = "UTC " + new Date().toISOString().slice(11, 19); } t(); setInterval(t, 1000);
})();

/* ---------- theatre maps: historical borders and names, coastlines, shared battle lines, key cities ---------- */
(function () {
  var L1 = "#5aa9ff", R1 = "#ff7a7a", L2 = "#5aa9ff", R2 = "#ff7a7a", NEU = "rgba(255,255,255,.7)", DIM = "rgba(255,255,255,.6)", WH = "rgba(255,255,255,.95)";
  /* side: L = left column, R = right column. Names not listed stay neutral. rename: period names. */
  var CFG = {
    t1: { year: 1400, lon: [-4.8, 6.6], lat: [42.4, 52.4], cap: "Borders c. 1400 / fronts 1429",
      heads: ["Defender", "Attacker"], colors: [L1, R1], left: ["Kingdom of France"], right: ["Kingdom of England"],
      side: { "France": "L", "English territory": "R" },
      rename: { "English territory": "Kingdom of England", "France": "Kingdom of France", "Britany": "Duchy of Brittany", "Castile": "Crown of Castile", "Aragón": "Crown of Aragon", "Navarre": "Kingdom of Navarre", "Scotland": "Kingdom of Scotland" },
      pos: { "Kingdom of England": [-1.9, 52.0], "Kingdom of France": [2.4, 46.9], "Duchy of Brittany": [-2.9, 48.35], "Holy Roman Empire": [5.3, 50.9] },
      extra: [["English Guyenne", -0.85, 44.15, "R"], ["Duchy of Burgundy", 4.9, 48.1, "R"]],
      noTint: { "English territory": 47 },
      /* territory held at the date of each line, drawn only while that line is shown; same points as the line plus its closing edge */
      zones: {
        "t1-north": [[48.64, -1.51], [48.60, -0.90], [48.43, -0.09], [48.20, 0.10], [47.99, 0.20], [47.95, 1.00], [47.90, 1.91], [47.80, 2.90], [47.80, 3.57], [47.45, 3.95], [47.00, 4.35], [46.60, 4.55], [46.25, 4.85], [46.10, 5.55], [46.10, 8.00], [52.60, 8.00], [52.60, 1.50], [51.50, 1.00], [50.30, 0.00], [49.80, -1.00], [50.00, -2.40], [48.90, -2.40]],
        "t1-gascony": [[45.62, -1.04], [45.50, -0.40], [45.20, 0.20], [45.00, 0.60], [44.65, 0.60], [44.25, 0.20], [43.90, -0.20], [43.60, -0.45], [43.35, -0.90], [43.30, -1.50], [43.30, -3.00], [45.62, -3.00]]
      },
      zoneOn: ["France", "English territory"],
      cities: [["London", 51.51, -0.13, "t"], ["Calais", 50.95, 1.86, "l"], ["Rouen", 49.44, 1.10, "l"], ["Paris", 48.86, 2.35, "r"], ["Orléans", 47.90, 1.91, "b"], ["Bordeaux", 44.84, -0.58, "r"]],
      sea: [["ENGLISH CHANNEL", -2.6, 49.9], ["BAY OF BISCAY", -3.2, 44.4]] },
    t2: { year: 1914, lon: [-10, 40], lat: [36, 59.5], cap: "Borders 1914",
      heads: ["Allied Powers", "Central Powers"], colors: [L2, R2],
      left: ["France", "United Kingdom of Great Britain and Ireland", "Russian Empire", "Kingdom of Italy", "Belgium", "Serbia", "United States", "Empire of Japan"],
      right: ["German Empire", "Austro-Hungarian Empire", "Ottoman Empire", "Bulgaria"],
      side: { "France": "L", "United Kingdom of Great Britain and Ireland": "L", "Russian Empire": "L", "Kingdom of Italy": "L", "Belgium": "L", "Serbia": "L", "German Empire": "R", "Austro-Hungarian Empire": "R", "Ottoman Empire": "R", "Bulgaria": "R" },
      rename: {},
      pos: { "Russian Empire": [31, 55.5], "Austro-Hungarian Empire": [20.5, 47.3], "German Empire": [10.4, 51.9], "France": [2.4, 46.7], "United Kingdom of Great Britain and Ireland": [-3.3, 54.0], "Kingdom of Italy": [12.6, 43.1], "Ottoman Empire": [33.5, 38.8], "Spain": [-3.7, 40.2], "Sweden": [15, 58.6], "Romania": [25, 45.7], "Bulgaria": [25.2, 42.6] },
      extra: [], noTint: {}, zones: {}, zoneOn: [],
      cities: [["London", 51.51, -0.13, "l"], ["Paris", 48.86, 2.35, "l"], ["Berlin", 52.52, 13.40, "t"], ["Vienna", 48.21, 16.37, "b"], ["Rome", 41.90, 12.50, "l"], ["Constantinople", 41.01, 28.98, "t"]],
      sea: [["NORTH SEA", 2.2, 57.6], ["MEDITERRANEAN", 13, 36.6]] }
  };
  /* key cities come from cities.js: every Hundred Years' War city, and the main city of each country in 1914 */
  if (window.SENTINEL_CITIES) {
    var inBox = function (c, k) { return c[1] >= CFG[k].lat[0] && c[1] <= CFG[k].lat[1] && c[2] >= CFG[k].lon[0] && c[2] <= CFG[k].lon[1]; };
    CFG.t1.cities = SENTINEL_CITIES.t1.slice(0, 15).filter(function (c) { return inBox(c, "t1"); });
    CFG.t2.cities = SENTINEL_CITIES.t2.filter(function (g) { return g.bloc !== "N"; }).map(function (g) { var c = g.cities[0]; return [c[0], c[1], c[2], "r"]; }).filter(function (c) { return inBox(c, "t2"); });
  }
  var land = null, borders = {}, LINES = null, draws = [];
  var wrap = function (s, n) { var w = s.split(" "), out = [], cur = ""; w.forEach(function (x) { if ((cur + " " + x).trim().length > n && cur) { out.push(cur); cur = x; } else cur = (cur + " " + x).trim(); }); if (cur) out.push(cur); return out; };

  function setup(card) {
    var key = card.getAttribute("data-map"), cfg = CFG[key], cv = card.querySelector("canvas"), x = cv.getContext("2d"), box = card.querySelector(".lines");
    function col(t, c, list) { return "<div style=\"--c:" + c + "\"><h4>" + t + "</h4><ul>" + list.map(function (n) { return "<li>" + n + "</li>"; }).join("") + "</ul></div>"; }
    card.querySelector(".sides2").innerHTML = col(cfg.heads[0], cfg.colors[0], cfg.left) + col(cfg.heads[1], cfg.colors[1], cfg.right);
    var W, H, dpr, proj;
    function sideColor(s) { return s === "L" ? cfg.colors[0] : s === "R" ? cfg.colors[1] : NEU; }
    function draw() {
      dpr = Math.min(window.devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; if (!W) return;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      var mid = (cfg.lat[0] + cfg.lat[1]) / 2, c = Math.cos(mid * Math.PI / 180), k = Math.min(W / ((cfg.lon[1] - cfg.lon[0]) * c), H / (cfg.lat[1] - cfg.lat[0])), cx = (cfg.lon[0] + cfg.lon[1]) / 2;
      proj = function (lat, lon) { return [W / 2 + (lon - cx) * c * k, H / 2 - (lat - mid) * k]; };
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#06142c"); g.addColorStop(1, "#040c1c"); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = "rgba(41,151,255,.10)"; x.lineWidth = 1; x.beginPath();
      for (var lo = -20; lo <= 60; lo += 5) { var a = proj(0, lo); x.moveTo(a[0] + .5, 0); x.lineTo(a[0] + .5, H); }
      for (var la = 20; la <= 70; la += 5) { var d = proj(la, 0); x.moveTo(0, d[1] + .5); x.lineTo(W, d[1] + .5); }
      x.stroke();
      var B = borders[key], coast = function () { land.forEach(function (r) { for (var i = 0; i < r.length; i++) { var p = proj(r[i][1], r[i][0]); if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); } x.closePath(); }); };
      if (land) { x.beginPath(); coast(); x.fillStyle = "rgba(41,151,255,.10)"; x.fill(); }
      if (land && B) {
        x.save(); x.beginPath(); coast(); x.clip();
        B.f.forEach(function (f) {
          var s = cfg.side[f.n];
          f.r.forEach(function (r) {
            x.beginPath(); for (var i = 0; i < r.length; i++) { var p = proj(r[i][1], r[i][0]); if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); } x.closePath();
            var cut = cfg.noTint[f.n], south = cut && Math.min.apply(null, r.map(function (p) { return p[1]; })) < cut;
            if (s && !south) { x.fillStyle = sideColor(s); x.globalAlpha = .2; x.fill(); x.globalAlpha = 1; }
            x.strokeStyle = "rgba(255,255,255,.4)"; x.lineWidth = .9; x.stroke();
          });
        });
        var live = {}; ((LINES && LINES[key]) || []).forEach(function (l) { if (!l.removed) live[l.id] = 1; });
        Object.keys(cfg.zones).forEach(function (id) {
          if (!live[id]) return;
          x.save(); x.beginPath();
          B.f.forEach(function (f) { if (cfg.zoneOn.indexOf(f.n) < 0) return; f.r.forEach(function (r) { for (var i = 0; i < r.length; i++) { var p = proj(r[i][1], r[i][0]); if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); } x.closePath(); }); });
          x.clip();
          x.beginPath(); cfg.zones[id].forEach(function (p, i) { var q = proj(p[0], p[1]); if (i) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); }); x.closePath();
          x.fillStyle = cfg.colors[1]; x.globalAlpha = .3; x.fill(); x.globalAlpha = 1; x.restore();
        });
        x.restore();
      }
      if (land) { x.beginPath(); coast(); x.strokeStyle = "rgba(140,200,255,.6)"; x.lineWidth = 1; x.stroke(); }
      /* names: historical, once each, in the side's colour */
      x.textAlign = "center"; x.textBaseline = "middle"; x.font = "600 8px 'IBM Plex Mono', monospace";
      function label(name, lon, lat, color) {
        var p = proj(lat, lon); if (p[0] < 20 || p[0] > W - 20 || p[1] < 8 || p[1] > H - 8) return;
        var ls = wrap(name.toUpperCase(), 15);
        ls.forEach(function (t, i) { var y = p[1] + (i - (ls.length - 1) / 2) * 10; x.lineWidth = 3; x.strokeStyle = "rgba(4,12,28,.85)"; x.strokeText(t, p[0], y); x.fillStyle = color; x.fillText(t, p[0], y); });
      }
      if (B) { var seen = {}; B.f.forEach(function (f) {
        var nm = cfg.rename[f.n] || f.n; if (seen[nm]) return; var at = cfg.pos[nm] || f.c; if (!at) return;
        var p = proj(at[1], at[0]); if (p[0] < 20 || p[0] > W - 20 || p[1] < 8 || p[1] > H - 8) return;
        seen[nm] = 1; label(nm, at[0], at[1], sideColor(cfg.side[f.n]));
      }); }
      cfg.extra.forEach(function (e) { label(e[0], e[1], e[2], sideColor(e[3])); });
      x.font = "600 8px 'IBM Plex Mono', monospace";
      cfg.sea.forEach(function (s) { var p = proj(s[2], s[1]); x.fillStyle = DIM; x.fillText(s[0].split("").join(String.fromCharCode(8202)), p[0], p[1]); });
      /* battle lines: one style for every line, ends marked */
      ((LINES && LINES[key]) || []).filter(function (l) { return !l.removed; }).forEach(function (l) {
        var pts = l.pts.map(function (p) { return proj(p[0], p[1]); });
        [[7, "rgba(255,255,255,.16)"], [2.4, WH]].forEach(function (st) {
          x.beginPath(); pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); });
          x.lineWidth = st[0]; x.strokeStyle = st[1]; x.lineJoin = "round"; x.lineCap = "round"; x.stroke();
        });
        [pts[0], pts[pts.length - 1]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 3.2, 0, 6.2832); x.fillStyle = "#06142c"; x.fill(); x.lineWidth = 1.6; x.strokeStyle = "#fff"; x.stroke(); });
      });
      /* key cities */
      x.font = "600 9.5px 'IBM Plex Sans', sans-serif";
      cfg.cities.forEach(function (c2) {
        var p = proj(c2[1], c2[2]), s = c2[3], o = 8;
        x.beginPath(); x.arc(p[0], p[1], 3, 0, 6.2832); x.fillStyle = "#fff"; x.fill(); x.strokeStyle = "#061226"; x.lineWidth = 1.5; x.stroke();
        x.textAlign = s === "l" ? "right" : s === "r" ? "left" : "center"; x.textBaseline = s === "t" ? "bottom" : s === "b" ? "top" : "middle";
        var tx = p[0] + (s === "l" ? -o : s === "r" ? o : 0), ty = p[1] + (s === "t" ? -o + 3 : s === "b" ? o - 3 : 0);
        x.lineWidth = 3; x.strokeStyle = "rgba(4,12,28,.9)"; x.strokeText(c2[0], tx, ty); x.fillStyle = "#fff"; x.fillText(c2[0], tx, ty);
      });
      x.textAlign = "right"; x.textBaseline = "middle"; x.font = "600 8.5px 'IBM Plex Mono', monospace"; x.fillStyle = "rgba(255,255,255,.7)"; x.fillText(cfg.cap.toUpperCase(), W - 10, H - 11);
    }
    box.hidden = true;
    draws.push(draw);
  }
  function all() { draws.forEach(function (d) { d(); }); }
  function loadLines() { return SentinelAuth.api("GET", "/api/lines").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) { LINES = j; } all(); }, all); }
  var cards = document.querySelectorAll(".pick-card[data-map]"); for (var i = 0; i < cards.length; i++) setup(cards[i]);
  window.addEventListener("resize", function () { draws.forEach(function (d) { d(); }); });
  var ready = (document.fonts && document.fonts.ready) || Promise.resolve();
  function json(u) { return fetch(u).then(function (r) { return r.json(); }); }
  Promise.all([json("land.json").then(function (j) { land = j.rings; }, function () {}), json("borders-1400.json").then(function (j) { borders.t1 = j; }, function () {}), json("borders-1914.json").then(function (j) { borders.t2 = j; }, function () {}), ready]).then(loadLines);
  all();
})();
