/*
 * HJCC Force Tracker - drag and drop for the Order of Battle board and the Battle tray.
 *
 *   HJCCDnD.init({ board, onOpen(id), onMove(id, frontId, orderedIds), onZone(id, zone), onCancel() })
 *   HJCCDnD.active() -> true while a pointer drag or a keyboard lift is in progress
 *
 * Plain browser JS, no dependencies, no inline handlers (CSP: script-src 'self').
 * Everything is delegated from `document`, so the app may re-render the board with innerHTML at any time.
 * Mouse / pen: drag after 5px.  Touch: press and hold ~280ms.  Keyboard: Space lifts, arrows move.
 */
(function () {
  "use strict";

  var MOUSE_SLOP = 5;      // px of movement before a mouse/pen press becomes a drag
  var TOUCH_SLOP = 10;     // px of movement that turns a touch press into a normal scroll
  var HOLD_MS = 280;       // touch press-and-hold time
  var EDGE = 60;           // auto-scroll hot zone, px
  var MAX_SPEED = 16;      // px per 60Hz frame at the very edge
  var TILT = 2.5;          // ghost tilt, degrees
  var IGNORE = "button, input, select, textarea, a, label, [data-a]";

  var cfg = null;          // callbacks + board selector
  var ready = false;       // listeners bound
  var S = null;            // pointer press / drag state
  var KB = null;           // keyboard lift state
  var live = null;         // aria-live region
  var suppressClickUntil = 0;

  /* ---------------------------------------------------------------- helpers */

  function noop() {}
  function call(name, a, b, c) {
    var fn = cfg && cfg[name];
    if (typeof fn !== "function") return;
    try { fn(a, b, c); } catch (err) { if (window.console) console.error("HJCCDnD " + name + " callback failed", err); }
  }

  function getBoard() {
    if (!cfg || !cfg.board) return null;
    return typeof cfg.board === "string" ? document.querySelector(cfg.board) : cfg.board;
  }

  function isCard(el) { return !!(el && el.classList && el.classList.contains("card")); }

  function cardsOf(body, skip) {
    var out = [], kids = body.children;
    for (var i = 0; i < kids.length; i++) if (isCard(kids[i]) && kids[i] !== skip) out.push(kids[i]);
    return out;
  }

  function idsOf(body) {
    return cardsOf(body).map(function (c) { return c.getAttribute("data-id"); });
  }

  function emptyOf(body) {
    var kids = body.children;
    for (var i = kids.length - 1; i >= 0; i--) if (kids[i].classList.contains("col-empty")) return kids[i];
    return null;
  }

  /* put `card` in `body` before `ref` (a card in that body) or, with no ref, after the last card (before .col-empty) */
  function place(card, body, ref) {
    var before = ref || emptyOf(body);
    var already = card.parentNode === body && (before ? card.nextElementSibling === before : !card.nextElementSibling);
    if (already) return false;
    body.insertBefore(card, before || null);
    return true;
  }

  function bodyOf(col) { return col ? col.querySelector(".col-body") : null; }

  function findCard(id) {
    var board = getBoard();
    if (!board) return null;
    var all = board.querySelectorAll(".card");
    for (var i = 0; i < all.length; i++) if (all[i].getAttribute("data-id") === id) return all[i];
    return null;
  }

  function nameOf(card) {
    var n = card.getAttribute("aria-label");
    if (!n) { var el = card.querySelector(".c-name"); n = el ? el.textContent : ""; }
    n = (n || "").replace(/\s+/g, " ").trim();
    return n || "unit";
  }

  function colName(col) {
    var h = col.querySelector(".col-h h3") || col.querySelector(".col-h h2") || col.querySelector(".col-h h4");
    var t = h ? h.textContent.replace(/\s+/g, " ").trim() : "";
    return t || col.getAttribute("data-front") || "column";
  }

  function announce(msg) {
    if (!live) return;
    live.textContent = "";
    window.setTimeout(function () { if (live) live.textContent = msg; }, 40);
  }

  function sameList(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /* After the app re-renders, keyboard users must not lose their place. */
  function refocus(id) {
    function go() {
      var ae = document.activeElement;
      if (ae && ae !== document.body && ae !== document.documentElement) return;
      var c = findCard(id);
      if (c) { try { c.focus({ preventScroll: true }); } catch (e) { c.focus(); } }
    }
    go();
    if (window.requestAnimationFrame) window.requestAnimationFrame(function () { go(); window.requestAnimationFrame(go); });
  }

  function setHot(el) {
    if (!S || S.hot === el) return;
    if (S.hot && S.hot.classList) S.hot.classList.remove("hot");
    S.hot = el || null;
    if (el) el.classList.add("hot");
  }

  /* ------------------------------------------------------------ pointer path */

  function onPointerDown(e) {
    if (!cfg) return;
    if (KB) cancelKb(false);
    if (S) return;                                        // second finger / button while one is active
    if (e.isPrimary === false) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var card = t.closest(".card");
    var board = getBoard();
    if (!card || !board || !board.contains(card)) return;
    var ign = t.closest(IGNORE);
    if (ign && ign !== card && card.contains(ign)) return;   // the card's own controls
    var id = card.getAttribute("data-id");
    if (!id) return;

    var r = card.getBoundingClientRect();
    S = {
      pid: e.pointerId, type: e.pointerType || "mouse", touch: e.pointerType === "touch",
      id: id, card: card,
      sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY,
      offX: e.clientX - r.left, offY: e.clientY - r.top, w: r.width,
      dragging: false, timer: 0, raf: 0, last: 0, dirty: false,
      ghost: null, hot: null, target: null,
      origBody: card.parentNode, origNext: card.nextElementSibling,
      startFront: null, startOrder: null
    };
    try { card.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    window.addEventListener("blur", onWindowBlur);

    if (S.touch) S.timer = window.setTimeout(function () { if (S && !S.dragging) startDrag(); }, HOLD_MS);
  }

  function onPointerMove(e) {
    if (!S || e.pointerId !== S.pid) return;
    S.x = e.clientX; S.y = e.clientY;
    if (!S.dragging) {
      var d = Math.sqrt((S.x - S.sx) * (S.x - S.sx) + (S.y - S.sy) * (S.y - S.sy));
      if (S.touch) { if (d > TOUCH_SLOP) endPress(); }          // finger moved first: ordinary scroll
      else if (d > MOUSE_SLOP) startDrag();
      return;
    }
    if (!S.touch && e.pointerType === "mouse" && e.buttons === 0) { cancelDrag(); return; }   // button released outside the window
    S.dirty = true;
    if (e.cancelable) e.preventDefault();
  }

  function onPointerUp(e) {
    if (!S || e.pointerId !== S.pid) return;
    S.x = e.clientX; S.y = e.clientY;
    if (!S.dragging) {
      var id = S.id;
      endPress();
      call("onOpen", id);                                         // plain click / quick tap
      return;
    }
    update();                                                     // final hit-test at the release point
    if (S) dropDrag();
  }

  function onPointerCancel(e) {
    if (!S || e.pointerId !== S.pid) return;
    if (S.dragging) cancelDrag(); else endPress();
  }

  function onWindowBlur() {
    if (S && S.dragging) cancelDrag();
    else if (S) endPress();
  }

  /* leave the press without having started a drag */
  function endPress() {
    if (!S) return;
    window.clearTimeout(S.timer);
    unbind();
    S = null;
  }

  function unbind() {
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("pointercancel", onPointerCancel, true);
    window.removeEventListener("blur", onWindowBlur);
  }

  function startDrag() {
    if (!S) return;
    window.clearTimeout(S.timer);
    var card = S.card;
    if (!card.isConnected) { card = findCard(S.id); if (!card) { endPress(); return; } S.card = card; }
    var body = card.parentNode;
    S.origBody = body; S.origNext = card.nextElementSibling;
    var col = body.closest ? body.closest(".col") : null;
    S.startFront = col ? col.getAttribute("data-front") : null;
    S.startOrder = idsOf(body);
    S.dragging = true;

    var rect = card.getBoundingClientRect();
    S.offX = Math.max(0, Math.min(rect.width, S.sx - rect.left));
    S.offY = Math.max(0, Math.min(rect.height, S.sy - rect.top));

    var g = card.cloneNode(true);
    g.removeAttribute("id"); g.removeAttribute("data-id"); g.removeAttribute("tabindex"); g.removeAttribute("aria-label");
    g.setAttribute("aria-hidden", "true");
    var withId = g.querySelectorAll("[id]");
    for (var i = 0; i < withId.length; i++) withId[i].removeAttribute("id");
    var withTab = g.querySelectorAll("[tabindex]");
    for (var j = 0; j < withTab.length; j++) withTab[j].setAttribute("tabindex", "-1");
    g.classList.remove("dragging", "lifted", "hot");
    g.classList.add("ghost");
    g.style.width = rect.width + "px";
    g.style.transformOrigin = S.offX + "px " + S.offY + "px";
    g.style.transform = "translate3d(" + (S.x - S.offX) + "px," + (S.y - S.offY) + "px,0) rotate(" + TILT + "deg)";
    document.body.appendChild(g);
    S.ghost = g;

    card.classList.add("dragging");
    document.body.classList.add("dnd");
    try { var sel = window.getSelection && window.getSelection(); if (sel && sel.removeAllRanges) sel.removeAllRanges(); } catch (e1) { /* ignore */ }
    try { document.documentElement.setPointerCapture(S.pid); } catch (e2) { /* ignore */ }
    if (S.touch && navigator.vibrate) { try { navigator.vibrate(15); } catch (e3) { /* ignore */ } }

    S.dirty = true;
    S.raf = window.requestAnimationFrame(frame);
  }

  /* one animation frame: auto-scroll, then (if anything moved) one hit-test + at most one DOM move */
  function frame(ts) {
    if (!S || !S.dragging) return;
    var dt = S.last ? Math.min(40, ts - S.last) : 16.7;
    S.last = ts;
    var scrolled = autoScroll(dt / 16.7);
    if (S.dirty || scrolled) { S.dirty = false; update(); }
    if (S && S.dragging) S.raf = window.requestAnimationFrame(frame);
  }

  function speed(depth, k) {
    var d = Math.max(0, Math.min(EDGE, depth));
    return Math.max(1, Math.ceil(MAX_SPEED * (d / EDGE) * k));
  }

  function autoScroll(k) {
    var board = getBoard(), moved = false, x = S.x, y = S.y, before;

    if (board && board.scrollWidth > board.clientWidth) {
      var br = board.getBoundingClientRect();
      if (y >= br.top && y <= br.bottom) {
        var l = Math.max(br.left, 0), r = Math.min(br.right, window.innerWidth);
        var dl = EDGE - (x - l), dr = EDGE - (r - x), dx = 0;
        if (dl > 0) dx = -speed(dl, k); else if (dr > 0) dx = speed(dr, k);
        if (dx) { before = board.scrollLeft; board.scrollLeft = before + dx; if (board.scrollLeft !== before) moved = true; }
      }
    }

    var colScrolled = false;
    var body = S.target && S.target.body;
    if (body && body.scrollHeight > body.clientHeight) {
      var cr = body.getBoundingClientRect();
      var dt1 = EDGE - (y - cr.top), db = EDGE - (cr.bottom - y), dy = 0;
      if (dt1 > 0) dy = -speed(dt1, k); else if (db > 0) dy = speed(db, k);
      if (dy) { before = body.scrollTop; body.scrollTop = before + dy; if (body.scrollTop !== before) { moved = true; colScrolled = true; } }
    }

    if (!colScrolled && !S.overTray) {
      var vh = window.innerHeight, wy = 0;
      if (y < EDGE) wy = -speed(EDGE - y, k); else if (y > vh - EDGE) wy = speed(EDGE - (vh - y), k);
      if (wy) { before = window.pageYOffset; window.scrollBy(0, wy); if (window.pageYOffset !== before) moved = true; }
    }
    return moved;
  }

  function update() {
    if (!S || !S.dragging) return;
    if (!S.card.isConnected) {                                     // app re-rendered despite active(): adopt the new element
      var again = findCard(S.id);
      if (!again) { cancelDrag(); return; }
      S.card = again; again.classList.add("dragging");
    }
    var x = S.x, y = S.y;
    S.ghost.style.transform = "translate3d(" + (x - S.offX) + "px," + (y - S.offY) + "px,0) rotate(" + TILT + "deg)";

    var el = document.elementFromPoint(x, y);
    var board = getBoard();
    var zone = el && el.closest ? el.closest("[data-zone]") : null;
    var col = null;
    if (!zone && el && el.closest && board) {
      col = el.closest(".col[data-front]");
      if (col && !board.contains(col)) col = null;
    }
    S.overTray = !!(el && el.closest && el.closest(".tray"));

    if (zone) {
      S.target = { zone: zone.getAttribute("data-zone") };
      setHot(zone);
    } else if (col) {
      var body = bodyOf(col);
      if (!body) { S.target = null; setHot(null); return; }
      S.target = { front: col.getAttribute("data-front"), body: body };
      setHot(col);
      var others = cardsOf(body, S.card), ref = null;
      for (var i = 0; i < others.length; i++) {
        var r = others[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) { ref = others[i]; break; }
      }
      place(S.card, body, ref);
    } else {
      S.target = null;
      setHot(null);
    }
  }

  function dropDrag() {
    var s = S, t = s.target, card = s.card;
    var id = s.id;
    var result = null;
    if (t && t.zone != null) {
      result = { zone: t.zone };
    } else if (t && t.body) {
      var ids = idsOf(t.body);
      if (t.front === s.startFront && sameList(ids, s.startOrder)) result = { nochange: true };
      else result = { front: t.front, ids: ids };
    }
    finish(true);
    if (!result || result.nochange) {
      restore(card, s.origBody, s.origNext);
      call("onCancel");
    } else if (result.zone != null) {
      call("onZone", id, result.zone);
    } else {
      call("onMove", id, result.front, result.ids);
    }
  }

  function cancelDrag() {
    if (!S) return;
    var s = S;
    finish(true);
    restore(s.card, s.origBody, s.origNext);
    call("onCancel");
  }

  /* remove ghost / classes / listeners and forget the state */
  function finish(swallowClick) {
    var s = S;
    if (!s) return;
    window.clearTimeout(s.timer);
    if (s.raf) window.cancelAnimationFrame(s.raf);
    unbind();
    try { document.documentElement.releasePointerCapture(s.pid); } catch (e) { /* ignore */ }
    if (s.ghost && s.ghost.parentNode) s.ghost.parentNode.removeChild(s.ghost);
    document.body.classList.remove("dnd");
    sweep();
    if (swallowClick) suppressClickUntil = Date.now() + 400;
    S = null;
  }

  function sweep() {
    var x = document.querySelectorAll(".card.dragging, .card.lifted, .col.hot, .tray-z.hot");
    for (var i = 0; i < x.length; i++) x[i].classList.remove("dragging", "lifted", "hot");
  }

  function restore(card, body, next) {
    if (!card || !card.isConnected || !body || !body.isConnected) return;
    var ref = next && next.parentNode === body && isCard(next) ? next : null;
    place(card, body, ref);
  }

  /* ------------------------------------------------------------- keyboard path */

  function onKeyDown(e) {
    if (!cfg) return;
    var key = e.key;

    if (S && S.dragging) {                                        // pointer drag in progress
      if (key === "Escape" || key === "Esc") { e.preventDefault(); e.stopPropagation(); cancelDrag(); }
      return;
    }
    if (KB) { kbKey(e); return; }

    var t = e.target;
    if (!isCard(t) || e.altKey || e.ctrlKey || e.metaKey) return;
    var board = getBoard();
    if (!board || !board.contains(t)) return;

    if (key === " " || key === "Spacebar" || e.code === "Space") {
      e.preventDefault();
      if (!e.repeat) lift(t);
    } else if (key === "Enter") {
      e.preventDefault();
      if (!e.repeat) call("onOpen", t.getAttribute("data-id"));
    }
  }

  function lift(card) {
    var id = card.getAttribute("data-id");
    if (!id) return;
    var body = card.parentNode;
    KB = { card: card, id: id, origBody: body, origNext: card.nextElementSibling, startFront: null, startOrder: idsOf(body), hot: null, moving: false };
    var col = body.closest ? body.closest(".col") : null;
    KB.startFront = col ? col.getAttribute("data-front") : null;
    card.classList.add("lifted");
    kbHot(col);
    announce("Picked up " + nameOf(card) + ". Use arrow keys to move, Space to drop, Escape to cancel.");
  }

  function kbHot(col) {
    if (!KB || KB.hot === col) return;
    if (KB.hot) KB.hot.classList.remove("hot");
    KB.hot = col || null;
    if (col) col.classList.add("hot");
  }

  function kbCard() {
    if (!KB) return null;
    if (!KB.card.isConnected) {
      var again = findCard(KB.id);
      if (!again) { kbEnd(); return null; }
      KB.card = again; again.classList.add("lifted");
    }
    return KB.card;
  }

  function kbKey(e) {
    var key = e.key;
    var card = kbCard();
    if (!card) return;
    var body = card.parentNode;
    var col = body.closest(".col");
    var dir = null;
    if (key === "ArrowUp") dir = "up"; else if (key === "ArrowDown") dir = "down";
    else if (key === "ArrowLeft") dir = "left"; else if (key === "ArrowRight") dir = "right";

    if (dir) {
      e.preventDefault(); e.stopPropagation();
      kbMove(card, body, col, dir);
    } else if (key === " " || key === "Spacebar" || e.code === "Space" || key === "Enter") {
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) dropKb();
    } else if (key === "Escape" || key === "Esc") {
      e.preventDefault(); e.stopPropagation();
      cancelKb(true);
    } else if (key !== "Tab" && key !== "Shift" && key !== "Control" && key !== "Alt" && key !== "Meta") {
      e.stopPropagation();                                        // keep app shortcuts quiet while a card is lifted
    }
  }

  function kbMove(card, body, col, dir) {
    var cards = cardsOf(body), idx = cards.indexOf(card);
    var msgBase = null;
    if (dir === "up" || dir === "down") {
      var n = dir === "up" ? idx - 1 : idx + 1;
      if (n < 0) { announce("Already at the top. Position 1 of " + cards.length + " in " + colName(col) + "."); return; }
      if (n >= cards.length) { announce("Already at the bottom. Position " + cards.length + " of " + cards.length + " in " + colName(col) + "."); return; }
      var other = cards[n];
      if (dir === "up") place(card, body, other); else place(card, body, cards[n + 1] || null);
      kbRefocus(card);
      msgBase = { col: col, pos: n + 1, total: cards.length };
    } else {
      var board = getBoard();
      var cols = board ? Array.prototype.slice.call(board.querySelectorAll(".col[data-front]")) : [];
      var ci = cols.indexOf(col), ti = dir === "left" ? ci - 1 : ci + 1;
      if (ci < 0 || ti < 0 || ti >= cols.length) {
        announce("Already in the " + (dir === "left" ? "first" : "last") + " column. Position " + (idx + 1) + " of " + cards.length + " in " + colName(col) + ".");
        return;
      }
      var tcol = cols[ti], tbody = bodyOf(tcol);
      if (!tbody) return;
      var tcards = cardsOf(tbody, card);
      var pos = Math.min(idx, tcards.length);
      place(card, tbody, tcards[pos] || null);
      kbHot(tcol);
      kbRefocus(card);
      msgBase = { col: tcol, pos: pos + 1, total: tcards.length + 1 };
    }
    announce("Moved to " + colName(msgBase.col) + ", position " + msgBase.pos + " of " + msgBase.total + ".");
  }

  /* a DOM move can blur the element in some browsers: put focus back and keep the card on screen */
  function kbRefocus(card) {
    KB.moving = true;
    try { card.focus({ preventScroll: true }); } catch (e) { card.focus(); }
    KB.moving = false;
    try { card.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e2) { card.scrollIntoView(false); }
  }

  function dropKb() {
    var k = KB, card = kbCard();
    if (!card) return;
    var body = card.parentNode, col = body.closest(".col");
    var front = col ? col.getAttribute("data-front") : null;
    var ids = idsOf(body);
    var pos = ids.indexOf(k.id) + 1, name = nameOf(card), cname = col ? colName(col) : "";
    var unchanged = front === k.startFront && sameList(ids, k.startOrder);
    if (unchanged || !front) restore(card, k.origBody, k.origNext);
    kbEnd();
    if (unchanged || !front) {
      announce("Dropped " + name + ". No change.");
      call("onCancel");
    } else {
      announce("Dropped " + name + " in " + cname + ", position " + pos + " of " + ids.length + ".");
      call("onMove", k.id, front, ids);
    }
    refocus(k.id);
  }

  function cancelKb(speak) {
    var k = KB;
    if (!k) return;
    var card = k.card.isConnected ? k.card : findCard(k.id);
    if (card) restore(card, k.origBody, k.origNext);
    kbEnd();
    if (speak) announce("Cancelled. " + (card ? nameOf(card) : "Unit") + " returned to its original position.");
    call("onCancel");
    if (speak) refocus(k.id);
  }

  function kbEnd() {
    if (!KB) return;
    if (KB.hot) KB.hot.classList.remove("hot");
    KB.card.classList.remove("lifted");
    KB = null;
    sweep();
  }

  function onFocusOut(e) {
    if (!KB || KB.moving || e.target !== KB.card) return;
    // focus left the lifted card on purpose (Tab, click elsewhere): drop the lift as a cancel
    var k = KB;
    window.setTimeout(function () {
      if (KB !== k) return;
      var ae = document.activeElement;
      if (ae === k.card) return;
      cancelKb(false);
    }, 0);
  }

  /* ------------------------------------------------------- misc suppression */

  function onTouchMove(e) {
    if (S && S.dragging && e.cancelable) e.preventDefault();
  }

  function onContextMenu(e) {
    if (S && (S.touch || S.dragging)) e.preventDefault();         // long-press menu / right click while dragging
  }

  function onClickCapture(e) {
    if (suppressClickUntil && Date.now() < suppressClickUntil) {
      suppressClickUntil = 0;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
  }

  function onDragStart(e) {
    var t = e.target;
    if (t && t.closest && t.closest(".card") && getBoard() && getBoard().contains(t)) e.preventDefault();   // no native image/link drag
  }

  function makeLive() {
    if (live || !document.body) return;
    live = document.createElement("div");
    live.className = "dnd-live";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    document.body.appendChild(live);
  }

  /* ------------------------------------------------------------------ public */

  function init(opts) {
    cfg = {
      board: (opts && opts.board) || "#board",
      onOpen: (opts && opts.onOpen) || noop,
      onMove: (opts && opts.onMove) || noop,
      onZone: (opts && opts.onZone) || noop,
      onCancel: (opts && opts.onCancel) || noop
    };
    if (ready) return;
    ready = true;
    if (document.body) makeLive(); else document.addEventListener("DOMContentLoaded", makeLive);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("dragstart", onDragStart);
  }

  window.HJCCDnD = {
    init: init,
    active: function () { return !!((S && S.dragging) || KB); }
  };
})();
