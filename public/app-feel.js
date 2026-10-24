/* The touches that make the hub feel like a phone app, on every page — the
   app's own (loaded by app/layout.tsx) and the two outside it (the Training
   Hub and Finances):

   - window.hubHaptic(): a light tap felt in the hand, for something important
     done (saved, ticked, paid). Android vibrates; an iPhone (which has no
     vibrate) gets the tick its switches make (lib/haptics.ts).
   - Pull down to refresh, from the top of the page. A page can say how
     (window.hubRefresh, returning a promise: Finances re-syncs rather than
     reloading, which would lock it) and when not (window.hubCanPull()).
     Never while typing, with a pop-up open, or with changes not saved yet
     (data-unsaved).
   - In the App Store app, a swipe in from the left edge goes back, as on an
     iPhone, wherever the page has a back button (data-swipe-back: the round
     one in app/components/SettingsUI.tsx TopBar). Safari has its own.
   - Which way a move between pages goes, for its slide (globals.css:
     html[data-nav]): forward for a link, back for a back button or the
     browser's Back, a cross-fade between the tab bar's tabs. */
(function () {
  if (window.hubHaptic) return;
  var ua = navigator.userAgent;
  var iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var inApp = ua.indexOf("GrassrootsClubHubApp") >= 0;

  // ---- haptics ----
  var tick = null;
  window.hubHaptic = function () {
    try {
      if (!iOS && navigator.vibrate) { navigator.vibrate(10); return; }
      // an iPhone ticks when a switch is toggled, even one that isn't shown
      if (!tick) {
        tick = document.createElement("label");
        tick.setAttribute("aria-hidden", "true");
        tick.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9px;top:-9px";
        var input = document.createElement("input");
        input.type = "checkbox";
        input.setAttribute("switch", "");
        input.tabIndex = -1;
        tick.appendChild(input);
        document.body.appendChild(tick);
      }
      tick.click();
    } catch {}
  };

  // ---- which way pages move ----
  var root = document.documentElement;
  var setNav = function (dir) { root.dataset.nav = dir; };
  window.addEventListener("popstate", function () { setNav("back"); }, true);
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    if (t.closest("[data-swipe-back]")) return setNav("back");
    if (t.closest(".hub-tabbar, #hub-tabbar")) return setNav("tab");
    if (t.closest("a[href]")) setNav("forward");
  }, true);
  // A back button going back in history (lib/back.ts): the slide is started
  // here, before stepping back, as a move back through history doesn't start
  // one itself. The new page is caught once the page has changed and settled.
  var historyBack = history.back.bind(history);
  var reduced = matchMedia("(prefers-reduced-motion: reduce)");
  history.back = function () {
    if (!document.startViewTransition || reduced.matches || root.dataset.nav !== "back") return historyBack();
    document.startViewTransition(function () {
      return new Promise(function (resolve) {
        var settled = false;
        var finish = function () { if (!settled) { settled = true; obs.disconnect(); resolve(); } };
        var quiet = null;
        var obs = new MutationObserver(function () {
          clearTimeout(quiet);
          quiet = setTimeout(finish, 60);
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(finish, 700);
        historyBack();
      });
    });
  };

  // ---- the indicators, drawn once ----
  var style = document.createElement("style");
  style.textContent =
    "#hub-pull{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 8px);z-index:250;width:40px;height:40px;margin-left:-20px;border-radius:50%;background:#fff;color:#15803d;box-shadow:0 2px 10px rgba(0,0,0,.15);display:grid;place-items:center;opacity:0;transform:translateY(-60px);pointer-events:none}" +
    "html.dark #hub-pull{background:#2c2c2e;color:#4ade80}" +
    "#hub-pull svg{width:22px;height:22px;transition:transform .15s}" +
    "#hub-pull.ready svg{transform:rotate(180deg)}" +
    "#hub-pull.spin svg{animation:hub-spin .8s linear infinite}" +
    "@keyframes hub-spin{to{transform:rotate(360deg)}}" +
    "#hub-edge{position:fixed;left:0;top:50%;z-index:250;width:44px;height:44px;margin-top:-22px;border-radius:50%;background:#fff;color:#111827;box-shadow:0 2px 10px rgba(0,0,0,.15);display:grid;place-items:center;opacity:0;transform:translateX(-50px);pointer-events:none}" +
    "html.dark #hub-edge{background:#2c2c2e;color:#f9fafb}" +
    "#hub-edge.ready{background:#15803d;color:#fff}" +
    "#hub-edge svg{width:22px;height:22px}";
  document.head.appendChild(style);
  var make = function (id, svg) {
    var el = document.getElementById(id);
    if (el) return el;
    el = document.createElement("div");
    el.id = id;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = svg;
    document.body.appendChild(el);
    return el;
  };
  var ARROW_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
  var SPINNER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>';
  var ARROW_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';

  // a pop-up, a sheet or a box being typed in: leave the touch alone
  var busy = function (target) {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== "checkbox" && a.type !== "radio") return true;
    if (document.querySelector('[aria-modal="true"], dialog[open], .modal-backdrop.open, #modal-backdrop.open')) return true;
    // changes not saved yet (a page marks them): a refresh would lose them
    if (document.querySelector("[data-unsaved]")) return true;
    if (target && target.closest && target.closest("input, textarea, select, [data-no-pull], [role=dialog]")) return true;
    return false;
  };

  // ---- pull down to refresh ----
  var PULL_AT = 70;
  var pull = null; // { y, x, dist, ready }
  var refreshing = false;
  var pullEl = null;
  var showPull = function (dist, ready) {
    pullEl = pullEl || make("hub-pull", ARROW_DOWN);
    var y = Math.min(dist, PULL_AT + 30) - 60;
    pullEl.style.transition = "none";
    pullEl.style.transform = "translateY(" + y + "px) rotate(" + dist * 2 + "deg)";
    pullEl.style.opacity = String(Math.min(dist / PULL_AT, 1));
    pullEl.classList.toggle("ready", ready);
  };
  var hidePull = function () {
    if (!pullEl) return;
    pullEl.style.transition = "transform .2s ease-in, opacity .2s";
    pullEl.style.transform = "translateY(-60px)";
    pullEl.style.opacity = "0";
    pullEl.classList.remove("ready", "spin");
    pullEl.innerHTML = ARROW_DOWN;
  };
  document.addEventListener("touchstart", function (e) {
    if (refreshing || e.touches.length !== 1 || window.scrollY > 0) return;
    if (busy(e.target)) return;
    if (typeof window.hubCanPull === "function" && !window.hubCanPull()) return;
    pull = { y: e.touches[0].clientY, x: e.touches[0].clientX, dist: 0, ready: false };
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (!pull) return;
    var dy = e.touches[0].clientY - pull.y;
    var dx = e.touches[0].clientX - pull.x;
    // sideways, scrolled away, or pushed up: not a pull after all
    if (window.scrollY > 0 || dy <= 0 || (pull.dist === 0 && Math.abs(dx) > Math.abs(dy))) {
      if (pull.dist) hidePull();
      pull = null;
      return;
    }
    pull.dist = dy * 0.5;
    var ready = pull.dist >= PULL_AT;
    if (ready && !pull.ready) window.hubHaptic();
    pull.ready = ready;
    showPull(pull.dist, ready);
  }, { passive: true });
  var endPull = function () {
    var p = pull;
    pull = null;
    if (!p || !p.dist) return;
    if (!p.ready) return hidePull();
    refreshing = true;
    pullEl.classList.remove("ready");
    pullEl.classList.add("spin");
    pullEl.innerHTML = SPINNER;
    pullEl.style.transition = "transform .2s ease-out";
    pullEl.style.transform = "translateY(" + (PULL_AT - 50) + "px)";
    var done = function () { refreshing = false; hidePull(); };
    if (typeof window.hubRefresh === "function") {
      Promise.resolve()
        .then(window.hubRefresh)
        .catch(function () {})
        .then(function () { setTimeout(done, 300); });
    } else {
      location.reload();
    }
  };
  document.addEventListener("touchend", endPull, { passive: true });
  document.addEventListener("touchcancel", endPull, { passive: true });

  // ---- swipe in from the left edge to go back (in the App Store app) ----
  if (!inApp) return;
  var EDGE = 24, BACK_AT = 80;
  var swipe = null; // { x, y, dist, ready }
  var edgeEl = null;
  document.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1 || e.touches[0].clientX > EDGE) return;
    if (!document.querySelector("[data-swipe-back]") || busy(e.target)) return;
    swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, dist: 0, ready: false };
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (!swipe) return;
    var dx = e.touches[0].clientX - swipe.x;
    var dy = e.touches[0].clientY - swipe.y;
    if (swipe.dist === 0 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
    swipe.dist = Math.max(dx, 0);
    var ready = swipe.dist >= BACK_AT;
    if (ready && !swipe.ready) window.hubHaptic();
    swipe.ready = ready;
    edgeEl = edgeEl || make("hub-edge", ARROW_BACK);
    edgeEl.style.transition = "none";
    edgeEl.style.transform = "translateX(" + (Math.min(swipe.dist, BACK_AT + 20) * 0.6 - 50) + "px)";
    edgeEl.style.opacity = String(Math.min(swipe.dist / BACK_AT, 1));
    edgeEl.classList.toggle("ready", ready);
  }, { passive: true });
  var endSwipe = function () {
    var s = swipe;
    swipe = null;
    if (!s || !edgeEl) return;
    edgeEl.style.transition = "transform .2s ease-in, opacity .2s";
    edgeEl.style.transform = "translateX(-50px)";
    edgeEl.style.opacity = "0";
    edgeEl.classList.remove("ready");
    if (!s.ready) return;
    var back = document.querySelector("[data-swipe-back]");
    if (back) back.click();
  };
  document.addEventListener("touchend", endSwipe, { passive: true });
  document.addEventListener("touchcancel", endSwipe, { passive: true });

})();
