/* The notifications bell, for the two pages outside the app's own routes (the
   Training Hub and Finances): put before Search in each header row
   (.hub-head-right), as app/components/NotificationBell.tsx is on the app's
   own pages. Signed in only; the red number is how many have come since
   Notifications was last opened. Light or dark follows <html class="dark">. */
(function () {
  var SAVED = "hub_inbox_unread";
  var css =
    ".hub-bell{position:relative;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.85);color:#374151;box-shadow:0 1px 3px rgba(0,0,0,.15);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);text-decoration:none}" +
    ".hub-bell svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".hub-bell b{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 6px;box-sizing:border-box;border-radius:10px;background:#ef4444;color:#fff;font:700 11px/20px -apple-system,system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #f2f2f7}" +
    "html.dark .hub-bell{background:rgba(28,28,30,.85);color:#e5e7eb}" +
    "html.dark .hub-bell b{box-shadow:0 0 0 2px #000}" +
    "@media print{.hub-bell{display:none}}";
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

  function draw(unread) {
    if (!document.getElementById("hub-bell-style")) {
      var style = document.createElement("style");
      style.id = "hub-bell-style";
      style.textContent = css;
      document.head.appendChild(style);
    }
    var rows = document.querySelectorAll(".hub-head-right");
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var bell = row.querySelector(".hub-bell");
      if (!bell) {
        bell = document.createElement("a");
        bell.className = "hub-bell";
        bell.href = "/notifications";
        // before Search, as in the app's own header
        var search = row.querySelector('a[href="/search"], .hub-search');
        row.insertBefore(bell, search || row.firstChild);
      }
      bell.setAttribute("aria-label", unread ? "Notifications, " + unread + " new" : "Notifications");
      bell.innerHTML = ICON + (unread ? "<b>" + (unread > 9 ? "9+" : unread) + "</b>" : "");
    }
  }

  function check() {
    fetch("/api/inbox?count=1", { cache: "no-store", credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        // signed out, or not in the club yet: no bell
        if (!d || typeof d.unread !== "number") return;
        try { localStorage.setItem(SAVED, String(d.unread)); } catch { /* private browsing */ }
        draw(d.unread);
      })
      .catch(function () {});
  }

  check();
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") check();
  });
})();
