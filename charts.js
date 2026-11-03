/* HJCC Force Tracker: charts module (area chart, donut, sparkline).
   Plain browser JS, no libraries. Exposes a single global: window.HJCCCharts
   Every function returns an HTML/SVG string; call HJCCCharts.bind(root) after the string has been put in the DOM.
   All colours come from the page's CSS custom properties (passed in as "var(--me)" etc. or used by charts.css). */
(function () {
  "use strict";

  var seq = 0;
  var SAFE_COL = /^[#a-zA-Z0-9(),.%\s\/_-]+$/;

  /* ---------- small helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }
  /* A colour is injected into a style="" attribute, so only a conservative character set is allowed. */
  function col(c, fb) {
    c = String(c == null ? "" : c).trim();
    return c && SAFE_COL.test(c) ? c : (fb || "var(--ink-3)");
  }
  function num(x) { x = Number(x); return isFinite(x) && x > 0 ? x : 0; }          /* NaN / negative / null -> 0 */
  function r1(x) { return String(Math.round(x * 10) / 10); }
  function r2(x) { return String(Math.round(x * 100) / 100); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function defFmt(n) {
    n = Number(n);
    if (!isFinite(n)) return "0";
    var a = Math.abs(n);
    if (a >= 1e6) return String(Math.round(n / 1e5) / 10) + "M";
    if (a >= 1e4) return String(Math.round(n / 100) / 10) + "k";
    if (Math.floor(n) === n) return String(n);
    return String(Math.round(n * 100) / 100);
  }
  function fmtOf(opts) {
    var f = opts && opts.fmt;
    if (typeof f !== "function") return defFmt;
    return function (n) { try { return String(f(n)); } catch (e) { return defFmt(n); } };
  }
  function hhmm(t, sec) {
    var d = new Date(t);
    if (isNaN(d.getTime())) return "--:--";
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + (sec ? ":" + pad(d.getSeconds()) : "");
  }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dmy(t) {
    var d = new Date(t);
    return isNaN(d.getTime()) ? "" : d.getDate() + " " + MON[d.getMonth()];
  }

  /* "Nice" axis: returns { top, step, ticks[] } with 3 to 5 intervals, steps of 1/2/5 x 10^k. */
  function niceAxis(max) {
    var raw = max / 4.5;
    var p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var f = raw / p, m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    var step = m * p;
    var cnt = Math.max(1, Math.ceil(max / step - 1e-9));
    var ticks = [];
    for (var i = 0; i <= cnt; i++) ticks.push(parseFloat((i * m * p).toPrecision(12)));
    return { top: ticks[ticks.length - 1], step: step, ticks: ticks };
  }

  /* Monotone cubic (Fritsch-Butland / d3 monotoneX style). No overshoot, so a curve through values >= 0 never dips below 0. */
  function curve(xs, ys) {
    var n = xs.length, d = [], m = [], i, h0, h1, d0, d1;
    if (n < 2) return "";
    for (i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / ((xs[i + 1] - xs[i]) || 1);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) {
      d0 = d[i - 1]; d1 = d[i];
      if (d0 * d1 <= 0) { m[i] = 0; continue; }
      h0 = xs[i] - xs[i - 1]; h1 = xs[i + 1] - xs[i];
      m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
    }
    var s = "M" + r1(xs[0]) + " " + r1(ys[0]);
    for (i = 0; i < n - 1; i++) {
      var dx = (xs[i + 1] - xs[i]) / 3;
      s += "C" + r1(xs[i] + dx) + " " + r1(ys[i] + m[i] * dx) + " " + r1(xs[i + 1] - dx) + " " + r1(ys[i + 1] - m[i + 1] * dx) + " " + r1(xs[i + 1]) + " " + r1(ys[i + 1]);
    }
    return s;
  }

  /* ---------- area chart ---------- */
  function area(series, times, opts) {
    opts = opts || {};
    var W = num(opts.w) || 720, H = num(opts.h) || 250;
    var emptyMsg = opts.empty != null ? opts.empty : "The chart fills in as your forces change.";   /* trusted markup, inserted as given */
    var empty = '<div class="chart-empty">' + emptyMsg + "</div>";
    var fmt = fmtOf(opts);

    if (!Array.isArray(series) || !Array.isArray(times) || times.length < 2) return empty;
    var n = times.length, S = [], si, i, mx = 0;
    for (si = 0; si < series.length; si++) {
      var sr = series[si];
      if (!sr || !Array.isArray(sr.v)) continue;
      var v = new Array(n), nz = false;
      for (i = 0; i < n; i++) { v[i] = num(sr.v[i]); if (v[i] > 0) { nz = true; if (v[i] > mx) mx = v[i]; } }
      if (!nz) continue;
      S.push({ n: sr.name == null ? "Series " + (S.length + 1) : String(sr.name), c: col(sr.col), v: v });
    }
    if (!S.length) return empty;

    var ax = niceAxis(mx), top = ax.top;
    var yl = ax.ticks.map(function (t) { return fmt(t); });
    var maxLen = 0;
    yl.forEach(function (s) { if (s.length > maxLen) maxLen = s.length; });
    var L = Math.max(34, Math.round(maxLen * 9.5 + 14)), R = 26, T = 14, B = 32;
    var pw = W - L - R, ph = H - T - B, bot = T + ph, dx = pw / (n - 1);
    var id = "hc" + (++seq);

    function X(k) { return L + k * dx; }
    function Y(val) { return bot - val / top * ph; }

    var svg = "";
    /* gradients */
    svg += "<defs>";
    var topOp = S.length > 1 ? 0.22 : 0.3;
    S.forEach(function (s, k) {
      svg += '<linearGradient id="' + id + "g" + k + '" gradientUnits="userSpaceOnUse" x1="0" y1="' + r1(T) + '" x2="0" y2="' + r1(bot) + '">' +
        '<stop offset="0" style="stop-color:' + esc(s.c) + ";stop-opacity:" + topOp + '"/>' +
        '<stop offset="1" style="stop-color:' + esc(s.c) + ';stop-opacity:0.02"/></linearGradient>';
    });
    svg += "</defs>";

    /* grid + y labels */
    ax.ticks.forEach(function (t, k) {
      var y = Y(t);
      svg += '<line class="' + (k === 0 ? "bl" : "gl") + '" x1="' + r1(L) + '" x2="' + r1(W - R) + '" y1="' + r1(y) + '" y2="' + r1(y) + '"/>';
      svg += '<text class="ax ay" x="' + r1(L - 8) + '" y="' + r1(y) + '" dy=".35em" text-anchor="end">' + esc(yl[k]) + "</text>";
    });

    /* x labels (spaced along the index, HH:MM local) */
    var cnt = Math.min(5, n), seen = "", xi = [];
    for (i = 0; i < cnt; i++) {
      var idx = Math.round(i * (n - 1) / (cnt - 1));
      if (xi.length && xi[xi.length - 1] === idx) continue;
      xi.push(idx);
    }
    xi.forEach(function (idx, k) {
      var lb = hhmm(times[idx]);
      if (lb === seen) return;                            /* many points in one minute: don't repeat the same label */
      seen = lb;
      var first = idx === 0, last = idx === n - 1;   /* edge labels are anchored inward so they never collide with the y labels or run off the right side */
      svg += '<text class="ax ax-x' + (first || last ? "" : " xo") + '" x="' + r1(X(idx) + (last ? 4 : 0)) + '" y="' + r1(bot + 8) + '" dy=".85em" text-anchor="' + (first ? "start" : last ? "end" : "middle") + '">' + lb + "</text>";
    });

    /* series */
    S.forEach(function (s, k) {
      var xs = [], ys = [];
      for (i = 0; i < n; i++) { xs.push(X(i)); ys.push(Y(s.v[i])); }
      var line = curve(xs, ys);
      svg += '<path class="ar" d="' + line + "L" + r1(xs[n - 1]) + " " + r1(bot) + "L" + r1(xs[0]) + " " + r1(bot) + 'Z" style="fill:url(#' + id + "g" + k + ');stroke:none"/>';
      svg += '<path class="ln" pathLength="1" d="' + line + '" style="fill:none;stroke:' + esc(s.c) + ';stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>';
    });
    /* last-point ring markers */
    S.forEach(function (s) {
      svg += '<circle class="hc-end" cx="' + r1(X(n - 1)) + '" cy="' + r1(Y(s.v[n - 1])) + '" r="4.5" style="fill:var(--panel);stroke:' + esc(s.c) + ';stroke-width:2"/>';
    });
    /* hover guide + hover points (hidden until bind() shows them) */
    svg += '<line class="hov hc-guide" x1="0" x2="0" y1="' + r1(T) + '" y2="' + r1(bot) + '"/>';
    S.forEach(function (s) {
      svg += '<circle class="hc-pt" cx="0" cy="0" r="5" style="fill:' + esc(s.c) + ';stroke:var(--panel);stroke-width:2"/>';
    });

    /* per-chart data for bind(): kept in a data attribute so there is no module state to leak */
    var multiDay = dmy(times[0]) !== dmy(times[n - 1]);
    var lbls = new Array(n);
    for (i = 0; i < n; i++) lbls[i] = (multiDay ? dmy(times[i]) + " " : "") + hhmm(times[i], true);
    var data = {
      w: W, l: L, dx: +dx.toFixed(4), t: T, b: bot, m: top, n: n, lb: lbls,
      s: S.map(function (s) {
        return { n: s.n, c: s.c, v: s.v.map(function (x) { return Math.round(x * 1e4) / 1e4; }), f: s.v.map(fmt) };
      })
    };

    var label = opts.label ? String(opts.label) : "Trend chart: " + S.map(function (s) { return s.n; }).join(", ");
    var out = '<div class="chart-wrap' + (opts.animate ? " anim" : "") + '" data-hc="' + id + '" data-hd="' + esc(JSON.stringify(data)) +
      '" tabindex="0" role="group" aria-label="' + esc(label) + '. Use the left and right arrow keys to read values.">' +
      '<svg class="area" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">' + svg + "</svg>" +
      '<div class="tip" aria-hidden="true"></div><div class="hc-sr" aria-live="polite"></div></div>';

    if (opts.legend) {
      out += '<div class="legend">' + S.map(function (s) {
        return '<span><i style="background:' + esc(s.c) + '"></i>' + esc(s.n) + "</span>";
      }).join("") + "</div>";
    }
    return out;
  }

  /* ---------- donut ---------- */
  function donut(segs, big, small, opts) {
    opts = opts || {};
    var size = num(opts.size) || 190, sw = num(opts.sw) || 26;
    if (sw > size / 2) sw = size / 2;
    var c = size / 2, r = (size - sw) / 2, C = 2 * Math.PI * r;
    var list = [], total = 0, i;
    (Array.isArray(segs) ? segs : []).forEach(function (s) {
      var v = s ? num(s.v) : 0;
      if (v > 0) { list.push({ v: v, c: col(s.c), t: s.t == null ? "" : String(s.t) }); total += v; }
    });
    var gap = list.length > 1 ? Math.min(3, C / list.length / 3) : 0;
    var body = '<circle class="trk" cx="' + r1(c) + '" cy="' + r1(c) + '" r="' + r2(r) + '" style="fill:none" stroke-width="' + r1(sw) + '"/>';
    var acc = 0;
    for (i = 0; i < list.length; i++) {
      var s = list[i], len = s.v / total * C, vis = Math.max(0.01, len - gap);
      body += '<circle class="sg" cx="' + r1(c) + '" cy="' + r1(c) + '" r="' + r2(r) + '" transform="rotate(-90 ' + r1(c) + " " + r1(c) + ')" ' +
        'stroke-width="' + r1(sw) + '" style="fill:none;--sw:' + r1(sw) + 'px;stroke:' + esc(s.c) + '" stroke-dasharray="' + r2(vis) + " " + r2(Math.max(0.01, C - vis)) +
        '" stroke-dashoffset="' + r2(-(acc + gap / 2)) + '"><title>' + esc(s.t + ": " + defFmt(s.v)) + "</title></circle>";
      acc += len;
    }
    var bigS = big == null ? "" : String(big), smallS = small == null ? "" : String(small);
    var bf = size >= 170 ? 32 : 24, sf = 12;   /* the app's type scale: 32 / 24 for the number, 12 for the caption */
    if (bigS.length > 5) bf = Math.max(12, Math.round(bf * 5 / bigS.length));
    if (bigS) {
      var by = smallS ? c + bf * 0.2 : c + bf * 0.36;
      body += '<text class="d-big" x="' + r1(c) + '" y="' + r1(by) + '" text-anchor="middle" style="font-size:' + bf + 'px">' + esc(bigS) + "</text>";
    }
    if (smallS) {
      body += '<text class="d-sm" x="' + r1(c) + '" y="' + r1(c + bf * 0.2 + sf + 6) + '" text-anchor="middle" style="font-size:' + sf + 'px">' + esc(smallS) + "</text>";
    }
    var label = opts.label ? String(opts.label) :
      ((bigS + " " + smallS).trim() + (list.length ? ": " + list.map(function (s) { return s.t + " " + defFmt(s.v); }).join(", ") : ""));
    return '<svg class="donut" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + esc(label) + '">' + body + "</svg>";
  }

  /* ---------- sparkline ---------- */
  function spark(vals, opts) {
    opts = opts || {};
    if (!Array.isArray(vals) || vals.length < 2) return "";
    var W = num(opts.w) || 140, H = num(opts.h) || 40, pad2 = 3;
    var v = vals.map(num), n = v.length, lo = Infinity, hi = -Infinity, i;
    for (i = 0; i < n; i++) { if (v[i] < lo) lo = v[i]; if (v[i] > hi) hi = v[i]; }
    var rng = hi - lo, xs = [], ys = [];
    for (i = 0; i < n; i++) {
      xs.push(i * W / (n - 1));
      ys.push(rng > 0 ? H - pad2 - (v[i] - lo) / rng * (H - 2 * pad2) : H / 2);
    }
    var line = curve(xs, ys);
    return '<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<path d="' + line + "L" + r1(W) + " " + H + "L0 " + H + 'Z" style="fill:currentColor;opacity:.16;stroke:none"/>' +
      '<path d="' + line + '" vector-effect="non-scaling-stroke" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/></svg>';
  }

  /* ---------- hover / keyboard wiring ---------- */
  function data(el) {
    if (el._hcd === undefined) {
      try { el._hcd = JSON.parse(el.getAttribute("data-hd")); } catch (e) { el._hcd = null; }
    }
    return el._hcd;
  }

  function fit(el) {
    var d = data(el), cw = el.clientWidth;
    if (!d || !cw) return;
    /* keep axis text a constant on-screen size however far the viewBox is scaled down */
    el.style.setProperty("--hc-s", clamp(d.w / cw, 0.6, 3.2).toFixed(3));
    if (cw < 440) el.setAttribute("data-narrow", ""); else el.removeAttribute("data-narrow");
  }

  var RO = typeof ResizeObserver === "function" ? new ResizeObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.target.isConnected) { RO.unobserve(e.target); return; }
      fit(e.target);
    });
  }) : null;
  if (!RO && typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("resize", function () {
      var all = document.querySelectorAll(".chart-wrap[data-hd]");
      for (var i = 0; i < all.length; i++) fit(all[i]);
    });
  }

  function hide(el) {
    el._hci = -1;
    var g = el.querySelector(".hc-guide"), t = el.querySelector(".tip");
    if (g) g.classList.remove("on");
    if (t) t.classList.remove("on");
    var pts = el.querySelectorAll(".hc-pt");
    for (var i = 0; i < pts.length; i++) pts[i].classList.remove("on");
  }

  function show(el, i, speak) {
    var d = data(el);
    if (!d) return;
    i = clamp(i, 0, d.n - 1);
    var svg = el.querySelector("svg"), tip = el.querySelector(".tip"), g = el.querySelector(".hc-guide");
    if (!svg || !tip || !g) return;
    var rect = svg.getBoundingClientRect();
    var sc = rect.width ? rect.width / d.w : 1;
    var x = d.l + i * d.dx;
    g.setAttribute("x1", x); g.setAttribute("x2", x);
    g.classList.add("on");

    var pts = el.querySelectorAll(".hc-pt"), minY = d.b, html = '<div class="tip-h">' + esc(d.lb[i]) + "</div>", spoken = d.lb[i];
    for (var k = 0; k < d.s.length; k++) {
      var s = d.s[k], y = d.b - s.v[i] / d.m * (d.b - d.t);
      if (y < minY) minY = y;
      if (pts[k]) { pts[k].setAttribute("cx", x); pts[k].setAttribute("cy", y); pts[k].classList.add("on"); }
      html += '<div class="tip-r"><i style="background:' + esc(s.c) + '"></i><span class="tip-n">' + esc(s.n) + "</span><b>" + esc(s.f[i]) + "</b></div>";
      spoken += ", " + s.n + " " + s.f[i];
    }
    tip.innerHTML = html;

    var cw = el.clientWidth, ch = el.clientHeight, tw = tip.offsetWidth, th = tip.offsetHeight;
    var px = x * sc, left = px + 14;
    if (left + tw > cw - 2) left = px - 14 - tw;
    left = clamp(left, 2, Math.max(2, cw - tw - 2));
    var top = clamp(minY * sc - th / 2, 2, Math.max(2, ch - th - 2));
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
    tip.classList.add("on");
    el._hci = i;
    if (speak) { var sr = el.querySelector(".hc-sr"); if (sr) sr.textContent = spoken; }
  }

  function wire(el) {
    if (el._hcb) return;                    /* already wired: never double-bind */
    el._hcb = true;
    var d = data(el);
    if (!d) return;
    fit(el);
    if (RO) RO.observe(el);

    function idxAt(e) {
      var svg = el.querySelector("svg"), r = svg.getBoundingClientRect();
      if (!r.width) return -1;
      return clamp(Math.round(((e.clientX - r.left) * (d.w / r.width) - d.l) / d.dx), 0, d.n - 1);
    }
    function move(e) {
      var i = idxAt(e);
      if (i >= 0 && i !== el._hci) show(el, i, false);
    }
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", move);
    el.addEventListener("pointerleave", function () { hide(el); });
    el.addEventListener("pointercancel", function () { hide(el); });
    el.addEventListener("focus", function () {
      var vis = true;
      try { vis = el.matches(":focus-visible"); } catch (e) { /* older engines */ }
      if (vis && !(el._hci >= 0)) show(el, d.n - 1, true);
    });
    el.addEventListener("blur", function () { hide(el); });
    el.addEventListener("keydown", function (e) {
      var i = el._hci >= 0 ? el._hci : d.n - 1, k = e.key, j = i;
      if (k === "ArrowLeft") j = i - 1;
      else if (k === "ArrowRight") j = i + 1;
      else if (k === "PageDown") j = i - 10;
      else if (k === "PageUp") j = i + 10;
      else if (k === "Home") j = 0;
      else if (k === "End") j = d.n - 1;
      else if (k === "Escape") { hide(el); return; }
      else return;
      e.preventDefault();
      show(el, j, true);
    });
  }

  function bind(root) {
    root = root || (typeof document !== "undefined" ? document : null);
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches(".chart-wrap[data-hd]")) wire(root);
    var all = root.querySelectorAll(".chart-wrap[data-hd]");
    for (var i = 0; i < all.length; i++) wire(all[i]);
  }

  window.HJCCCharts = { area: area, donut: donut, spark: spark, bind: bind };
})();
