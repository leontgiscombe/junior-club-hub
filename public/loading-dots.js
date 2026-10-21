/* The loading dots for the two pages outside the app's own routes, the
   Training Hub and Finances: the same three dots as the app's
   (app/components/Skeleton.tsx, globals.css .loading-dot). Each page has a
   #loading-dots element at the top of its body, so the dots show from the
   first paint, and calls loadingDots.hide() once it's ready. Tapping a link
   to another page (a tab, say) shows them again until that page arrives.
   Load it in the <head>, before the page's body. */
(function () {
  var style = document.createElement("style");
  style.textContent =
    "#loading-dots{position:fixed;inset:0;z-index:205;display:flex;align-items:center;justify-content:center;gap:12px;background:#f2f2f7}" +
    "#loading-dots[hidden]{display:none}" +
    "html.dark #loading-dots{background:#000}" +
    "#loading-dots span{width:14px;height:14px;border-radius:50%;background:#9ca3af;animation:loading-dot 1.2s ease-in-out infinite both}" +
    "html.dark #loading-dots span{background:rgba(255,255,255,.4)}" +
    "#loading-dots span:nth-child(2){animation-delay:160ms}" +
    "#loading-dots span:nth-child(3){animation-delay:320ms}" +
    /* the tab bar stays on top, as it does over the app's own dots */
    "#loading-dots:not([hidden])~#hub-tabbar{z-index:210}" +
    "@keyframes loading-dot{0%,80%,100%{transform:scale(.3)}40%{transform:scale(1)}}" +
    "@media (prefers-reduced-motion:reduce){#loading-dots span{animation:none;transform:scale(.6)}}" +
    "@media print{#loading-dots{display:none}}";
  document.head.appendChild(style);

  var el = function () { return document.getElementById("loading-dots"); };
  var set = function (on) { var d = el(); if (d) d.hidden = !on; };
  // a page that never says it's ready (a request that hangs) still shows itself
  var giveUp = setTimeout(function () { set(false); }, 10000);
  window.loadingDots = {
    show: function () { set(true); },
    hide: function () { clearTimeout(giveUp); set(false); }
  };
  // a tap on a link to another page (a tab, your photo): the dots until it arrives
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    window.loadingDots.show();
  });
  // back on the page from the browser's cache, after leaving: it's ready
  addEventListener("pageshow", function (e) { if (e.persisted) window.loadingDots.hide(); });
})();
