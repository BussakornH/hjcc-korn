/* SENTINEL sign-in background: a live global-watch globe built from Natural Earth coastlines (land.json).
   To use your own video instead, name it on the canvas: <canvas id="globe" data-video="login-bg.mp4">. Without that nothing is requested
   (asking for a file that is not there put a 404 in the log on every visit). */
(function () {
  var scene = document.querySelector(".scene"), cv = document.getElementById("globe"), x = cv.getContext("2d");
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W, H, D, R, R0, cx, cy, cache = null, gap = 0, prevT = 0, slow = 0, boosted = false, running = true, ang = 0.6, last = 0, MW = 2048, MH = 1024, mask = null, coast = [];

  var vsrc = cv.getAttribute("data-video");
  if (vsrc) fetch(vsrc, { method: "HEAD" }).then(function (r) {
    if (!r.ok || !/video/.test(r.headers.get("content-type") || "")) return;
    var v = document.createElement("video");
    v.src = vsrc; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute("playsinline", "");
    v.className = "vid"; scene.insertBefore(v, scene.firstChild); cv.style.display = "none"; running = false;
    v.play().catch(function () {});
  }).catch(function () {});

  /* land mask: rasterise the coastline rings once, then sample it per screen dot */
  fetch("land.json").then(function (r) { return r.json(); }).then(function (j) {
    var m = document.createElement("canvas"); m.width = MW; m.height = MH; var c = m.getContext("2d");
    c.fillStyle = "#fff"; c.beginPath();
    j.rings.forEach(function (ring) { ring.forEach(function (p, i) { var X = (p[0] + 180) / 360 * MW, Y = (90 - p[1]) / 180 * MH; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.closePath(); });
    c.fill("evenodd");
    var d = c.getImageData(0, 0, MW, MH).data; mask = new Uint8Array(MW * MH);
    for (var i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    coast = j.rings.filter(function (r) { return r.length > 7; }).map(function (r) { var f = new Float32Array(r.length * 3); r.forEach(function (p, i) { var v = vec(p[1] * Math.PI / 180, p[0] * Math.PI / 180); f[i * 3] = v[0]; f[i * 3 + 1] = v[1]; f[i * 3 + 2] = v[2]; }); return f; });
    if (still) frame(0);
  }).catch(function () {});

  function size() {
    D = Math.min(window.devicePixelRatio || 1, 1.5); W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * D; cv.height = H * D; x.setTransform(D, 0, 0, D, 0, 0);
    R0 = Math.min(H * 0.82, W * 0.6); R = R0; cx = W * 0.5; cy = H * 0.98 + R0 * 0.12; cv.style.transformOrigin = cx + "px " + cy + "px"; cache = null;
  }
  size(); window.addEventListener("resize", function () { size(); if (still) frame(0); });

  var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(7);
  var stars = []; for (var i = 0; i < 140; i++) stars.push({ x: rnd(), y: rnd() * 0.7, r: rnd() * 1.1 + .2, p: rnd() * 6.28 });

  var NODES = [[38.9, -77], [51.5, -.1], [48.9, 2.3], [55.7, 37.6], [30, 31.2], [35.7, 139.7], [-33.9, 151.2], [-23.5, -46.6], [28.6, 77.2], [1.3, 103.8], [64.1, -21.9]]
    .map(function (a) { return { lat: a[0] * Math.PI / 180, lon: a[1] * Math.PI / 180 }; });
  document.getElementById("links").textContent = NODES.length;
  var ARCS = [[0, 1], [1, 3], [3, 5], [5, 6], [0, 7], [2, 4], [4, 8], [8, 9], [9, 6], [1, 10], [10, 0], [3, 8]]
    .map(function (a, k) { return { a: NODES[a[0]], b: NODES[a[1]], off: k * 0.37 }; });

  function vec(lat, lon) { return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]; }
  function rot(v, a) { var c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; }
  function proj(v, k) { return [cx + R * k * v[0], cy - R * k * v[1]]; }

  window.SentinelGlobe = { boost: function () { boosted = true; cv.style.willChange = "transform"; cv.style.transition = "transform 1.9s cubic-bezier(.16,.8,.3,1)"; cv.style.transform = "scale(1.45)"; } };
  var STEP = 4, LB = [[], [], [], [], [], [], [], []], GRAT = [];
  (function () {
    function line(fn, cnt) { var f = new Float32Array((cnt + 1) * 3); for (var i = 0; i <= cnt; i++) { var v = fn(i / cnt); f[i * 3] = v[0]; f[i * 3 + 1] = v[1]; f[i * 3 + 2] = v[2]; } GRAT.push(f); }
    for (var la = -60; la <= 60; la += 15) (function (L) { line(function (t) { return vec(L * Math.PI / 180, t * 6.2832); }, 180); })(la);
    for (var lo = 0; lo < 360; lo += 15) (function (L) { line(function (t) { return vec((t - .5) * Math.PI, L * Math.PI / 180); }, 90); })(lo);
  })();
  var LC = new Int32Array(8), SEA = null;
  function buildGrid() {
    var st = STEP, x0 = Math.max(0, Math.floor((cx - R) / st) * st), x1 = Math.min(W, cx + R), y0 = Math.max(0, cy - R), y1 = Math.min(H, cy + R), cap = Math.ceil((x1 - x0) / st + 2) * Math.ceil((y1 - y0) / st + 2), n = 0;
    var g = { th: new Float32Array(cap), row: new Int32Array(cap), bin: new Uint8Array(cap), sea: new Uint8Array(cap), sx: new Float32Array(cap), sy: new Float32Array(cap), n: 0, dot: 1.5 * st / 4 };
    for (var sy = Math.floor(y0 / st) * st; sy < y1; sy += st) {
      var ny = (cy - sy) / R, rowOff = ((sy / st) & 1) ? st / 2 : 0, lat = Math.asin(Math.max(-1, Math.min(1, ny))), my = ((.5 - lat / 3.141593) * MH) | 0;
      for (var sx = x0 + rowOff; sx < x1; sx += st) {
        var nx = (sx - cx) / R, r2 = nx * nx + ny * ny; if (r2 >= 1) continue;
        var nz = Math.sqrt(1 - r2);
        g.th[n] = Math.atan2(nx, nz) / 6.283185 + 1; g.row[n] = my * MW; g.bin[n] = (nz * 7.99) | 0; g.sea[n] = ((sx / st + sy / st) & 3) === 0 ? 1 : 0; g.sx[n] = sx; g.sy[n] = sy; n++;
      }
    }
    g.n = n; for (var b = 0; b < 8; b++) LB[b] = new Float32Array(n * 2); SEA = new Float32Array(n * 2); return g;
  }
  function frame(t) {
    var dt = last ? Math.min(t - last, 50) : 16; last = t; if (!still) ang += dt * (boosted ? 0.0016 : 0.00007);
    x.clearRect(0, 0, W, H);
    var s, p, v, j, started;
    for (s = 0; s < stars.length; s++) { var st = stars[s], tw = still ? .7 : .5 + .5 * Math.sin(t * .001 + st.p); x.fillStyle = "rgba(200,220,255," + (.18 + .5 * tw) * .7 + ")"; x.beginPath(); x.arc(st.x * W, st.y * H, st.r, 0, 6.283); x.fill(); }

    var g = x.createRadialGradient(cx, cy, R * .85, cx, cy, R * 1.14); g.addColorStop(0, "rgba(41,151,255,0)"); g.addColorStop(.82, "rgba(41,151,255,.18)"); g.addColorStop(1, "rgba(41,151,255,0)");
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R * 1.14, 0, 6.283); x.fill();
    var og = x.createRadialGradient(cx, cy - R * .5, R * .1, cx, cy, R); og.addColorStop(0, "#0a1d3d"); og.addColorStop(1, "#030a18");
    x.fillStyle = og; x.beginPath(); x.arc(cx, cy, R, 0, 6.283); x.fill();
    x.lineWidth = 1; x.setLineDash([2, 8]);
    for (var rg = 1; rg <= 3; rg++) { x.strokeStyle = "rgba(120,180,255," + (.22 - rg * .05) + ")"; x.beginPath(); x.arc(cx, cy, R * (1 + rg * .12), 0, 6.283); x.stroke(); }
    x.setLineDash([]);

    /* graticule + coastlines: precomputed unit vectors, rotated inline */
    var ca = Math.cos(ang), sa = Math.sin(ang), arr, n, vx, vy, vz, rz;
    x.strokeStyle = "rgba(120,180,255,.16)"; x.lineWidth = 1; x.beginPath();
    for (var gi = 0; gi < GRAT.length; gi++) { arr = GRAT[gi]; started = false;
      for (n = 0; n < arr.length; n += 3) { vx = arr[n] * ca + arr[n + 2] * sa; rz = -arr[n] * sa + arr[n + 2] * ca;
        if (rz > 0) { if (!started) { x.moveTo(cx + R * vx, cy - R * arr[n + 1]); started = true; } else x.lineTo(cx + R * vx, cy - R * arr[n + 1]); } else started = false; } }
    x.stroke();

    /* land: fixed screen-space dot grid. Each dot's row, longitude offset and shade are worked out once per size; a frame only shifts the longitude and looks up the mask. */
    if (mask) {
      if (!cache) cache = buildGrid();
      var C = cache, u = ang / 6.283185 - .5, f, k2, nb, cnt = LC;
      for (b = 0; b < 8; b++) cnt[b] = 0; var sc = 0;
      for (k2 = 0; k2 < C.n; k2++) {
        f = C.th[k2] - u; f -= Math.floor(f);
        if (mask[C.row[k2] + ((f * MW) | 0)]) { b = C.bin[k2]; LB[b][cnt[b]++] = C.sx[k2]; LB[b][cnt[b]++] = C.sy[k2]; }
        else if (C.sea[k2]) { SEA[sc++] = C.sx[k2]; SEA[sc++] = C.sy[k2]; }
      }
      var ds = C.dot, dh = ds / 2;
      for (b = 0; b < 8; b++) { arr = LB[b]; if (!cnt[b]) continue; x.fillStyle = "rgba(150,212,255," + (.2 + .78 * (b + .5) / 8) + ")"; for (n = 0; n < cnt[b]; n += 2) x.fillRect(arr[n] - dh, arr[n + 1] - dh, ds, ds); }
      x.fillStyle = "rgba(80,130,210,.12)"; x.beginPath(); for (n = 0; n < sc; n += 2) x.rect(SEA[n] - .5, SEA[n + 1] - .5, 1, 1); x.fill();

      x.lineWidth = .8; x.strokeStyle = "rgba(160,220,255,.5)"; x.beginPath();
      for (var ci = 0; ci < coast.length; ci++) { arr = coast[ci]; started = false;
        for (n = 0; n < arr.length; n += 3) { rz = -arr[n] * sa + arr[n + 2] * ca;
          if (rz > 0.01) { vx = arr[n] * ca + arr[n + 2] * sa; if (!started) { x.moveTo(cx + R * vx, cy - R * arr[n + 1]); started = true; } else x.lineTo(cx + R * vx, cy - R * arr[n + 1]); } else started = false; } }
      x.stroke();
    }

    /* links + stations */
    var tt = still ? 0.5 : t * 0.00022;
    for (var k = 0; k < ARCS.length; k++) {
      var A = ARCS[k], va = vec(A.a.lat, A.a.lon), vb = vec(A.b.lat, A.b.lon), prog = ((tt + A.off) % 1.5) / 1.1, from = Math.max(0, prog - .4), to = Math.min(1, prog);
      if (from >= to) continue; x.beginPath(); started = false;
      for (j = 0; j <= 40; j++) {
        var f2 = from + (to - from) * j / 40, m = [va[0] + (vb[0] - va[0]) * f2, va[1] + (vb[1] - va[1]) * f2, va[2] + (vb[2] - va[2]) * f2], l = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]) || 1;
        var lift = 1 + .2 * Math.sin(Math.PI * f2); m = rot([m[0] / l, m[1] / l, m[2] / l], ang); if (m[2] > -.02) { p = proj(m, lift); if (!started) { x.moveTo(p[0], p[1]); started = true; } else x.lineTo(p[0], p[1]); } else started = false;
      }
      x.strokeStyle = "rgba(41,151,255,.9)"; x.lineWidth = 1.5; x.stroke();
    }
    for (var n2 = 0; n2 < NODES.length; n2++) {
      v = rot(vec(NODES[n2].lat, NODES[n2].lon), ang); if (v[2] <= 0.03) continue; p = proj(v, 1);
      var pulse = still ? .5 : (t * .0012 + n2) % 3 / 3;
      x.strokeStyle = "rgba(255,255,255," + (1 - pulse) * .5 + ")"; x.lineWidth = 1; x.beginPath(); x.arc(p[0], p[1], 3 + pulse * 14, 0, 6.283); x.stroke();
      x.fillStyle = "#fff"; x.beginPath(); x.arc(p[0], p[1], 2.2, 0, 6.283); x.fill();
    }
    /* slow machine (the drawing itself happens after this function returns, so watch the gap between frames): coarser dot grid instead of dropped frames */
    if (prevT && !document.hidden) { gap = gap ? gap * .9 + (t - prevT) * .1 : t - prevT; if (gap > 28 && STEP < 6 && t > 2500) { if (++slow > 45) { STEP++; cache = null; slow = 0; gap = 0; } } else slow = 0; }
    prevT = t;
    if (running && !still) requestAnimationFrame(frame);
  }
  frame(0); if (!still) requestAnimationFrame(frame);
})();
