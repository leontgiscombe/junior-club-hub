/* The app's floating tab bar, for the two pages outside the app's own routes
   (Financial Admin and the Training Hub), so they feel part of the app. It
   matches app/components/TabBar.tsx and lib/tabs.ts: each person's own tabs
   (Your Account → Tab Bar), or the usual Home, Training, Finances, Kit, then
   Coach (with people waiting to join) or Account / Sign In. Light or dark
   follows <html class="dark">, set by each page's theme script. */
(function () {
  var path = location.pathname.replace(/\/+$/, "") || "/";
  var ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
    training: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/>',
    finance: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    kit: '<path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0z"/>',
    coach: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    account: '<circle cx="12" cy="8.5" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    results: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
    matches: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/>',
    trainingLog: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    stats: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    members: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0M19 8v6M16 11h6"/>'
  };
  var css =
    "#hub-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:45;padding:0 12px max(12px,env(safe-area-inset-bottom));pointer-events:none;font-family:-apple-system,'SF Pro Text','Helvetica Neue',system-ui,sans-serif}" +
    "#hub-tabbar ul{pointer-events:auto;list-style:none;margin:0 auto;padding:6px;max-width:576px;display:flex;gap:2px;border-radius:999px;background:rgba(255,255,255,.85);box-shadow:0 8px 30px rgba(0,0,0,.16),0 0 0 1px rgba(0,0,0,.05);-webkit-backdrop-filter:blur(24px) saturate(1.5);backdrop-filter:blur(24px) saturate(1.5)}" +
    "#hub-tabbar li{flex:1}" +
    "#hub-tabbar a{position:relative;height:57px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:999px;font-size:11px;font-weight:600;color:#4b5563;text-decoration:none;transition:transform .12s ease,opacity .12s ease}" +
    "#hub-tabbar a:active{transform:scale(.97);opacity:.85}" +
    "#hub-tabbar a.on{background:rgba(21,128,61,.1);color:var(--color-green-700,#15803d);font-weight:700}" +
    "#hub-tabbar svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
    "#hub-tabbar .badge{position:absolute;top:4px;left:50%;margin-left:6px;min-width:20px;height:20px;padding:0 6px;box-sizing:border-box;border-radius:10px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;line-height:20px;text-align:center;box-shadow:0 0 0 2px #fff}" +
    /* below pop-up windows, so it never covers their buttons; above Financial Admin's password screen */
    "body.locked #hub-tabbar{z-index:210}" +
    "html.dark #hub-tabbar ul{background:rgba(28,28,30,.85);box-shadow:0 8px 30px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.1)}" +
    "html.dark #hub-tabbar a{color:#d1d5db}" +
    "html.dark #hub-tabbar a.on{background:rgba(74,222,128,.15);color:#4ade80}" +
    "html.dark #hub-tabbar .badge{box-shadow:0 0 0 2px #1c1c1e}" +
    /* room for the bar at the end of the page */
    "body{padding-bottom:calc(84px + env(safe-area-inset-bottom))}" +
    "@media print{#hub-tabbar{display:none}body{padding-bottom:0}}";

  function tab(href, label, icon, on, badge) {
    return (
      '<li><a href="' + href + '"' + (on ? ' class="on" aria-current="page"' : "") + ">" +
      '<span style="position:relative"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[icon] + "</svg></span>" +
      label +
      (badge ? '<span class="badge">' + (badge > 99 ? "99+" : badge) + "</span>" : "") +
      "</a></li>"
    );
  }

  function draw(club, me, pending) {
    var features = (club && club.club && club.club.features) || {};
    var signedIn = !!(me && me.user);
    var roles = (me && me.person && me.person.status === "approved" && me.person.roles) || [];
    var canCoach = !!(me && me.canCoach);
    var canFinance = roles.indexOf("treasurer") >= 0 || roles.indexOf("admin") >= 0;
    // the same tabs as lib/tabs.ts: each person's own choice (Your Account → Tab Bar), or the usual ones
    var publicResults = !!(club && club.club && club.club.publicResults);
    var DEFS = {
      home: ["/", "Home", "home"],
      training: ["/training-hub", "Training", "training"],
      finances: ["/finance", "Finances", "finance"],
      kit: ["/kit", "Kit", "kit"],
      coach: ["/admin", "Coach", "coach"],
      results: ["/results", "Results", "results"],
      account: signedIn ? ["/account", "Account", "account"] : ["/signin", "Sign In", "account"],
      matches: ["/admin/stats/matches", "Match Log", "matches"],
      trainingLog: ["/admin/stats/training", "Training Log", "trainingLog"],
      stats: ["/admin/stats", "Stats", "stats"],
      members: ["/admin/members", "Members", "members"]
    };
    var can = ["home"];
    if (features.trainingHub !== false) can.push("training");
    if (features.financialAdmin !== false && (canFinance || !signedIn)) can.push("finances");
    if (features.kitSizes !== false) can.push("kit");
    if (canCoach) can.push("coach");
    if (publicResults) can.push("results");
    can.push("account");
    if (canCoach) can.push("matches", "trainingLog", "stats", "members");
    var ids = ["home"];
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem("hub_tabs") || "null"); } catch { saved = null; }
    if (Array.isArray(saved)) {
      saved.forEach(function (id) { if (id !== "home" && can.indexOf(id) >= 0 && ids.indexOf(id) < 0) ids.push(id); });
    } else {
      ["training", "finances", "kit", "coach"].forEach(function (id) { if (can.indexOf(id) >= 0) ids.push(id); });
      if (!signedIn || ids.length < 5) ids.push("account");
    }
    var tabs = ids.slice(0, 5).map(function (id) {
      var d = DEFS[id];
      return tab(d[0], d[1], d[2], path === d[0], id === "coach" ? pending : 0);
    });
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    var nav = document.createElement("nav");
    nav.id = "hub-tabbar";
    nav.setAttribute("aria-label", "Main");
    nav.innerHTML = "<ul>" + tabs.join("") + "</ul>";
    document.body.appendChild(nav);
  }

  var json = function (url) {
    return fetch(url, { cache: "no-store", credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  };
  Promise.all([json("/api/club"), json("/api/auth/me")]).then(function (r) {
    var club = r[0], me = r[1];
    if (me && me.canCoach) {
      json("/api/members/alerts").then(function (a) { draw(club, me, (a && a.pending) || 0); });
    } else draw(club, me, 0);
  });
})();
