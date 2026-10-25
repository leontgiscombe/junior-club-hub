/* The hub's own pop-ups, as a phone app's, on every page — the app's own
   (loaded by app/layout.tsx, used through lib/dialog.ts) and the two outside it
   (the Training Hub and Finances) — instead of the browser's grey boxes:

   - window.hubConfirm(message, { ok, danger }) -> Promise<boolean>: a sheet
     from the bottom with the question, its button (red for something that
     can't be undone) and Cancel. A message's first paragraph is its title.
   - window.hubAlert(message) -> Promise: the same, with just OK.
   - window.hubPrompt(message, value) -> Promise<string | null>: with a box to type in.
   - window.hubToast(text, tone): a small pill that drops in at the top and
     fades away — "Saved", or (tone "error") what went wrong.
   - A page's large title ([data-large-title]) shrinks into a bar at the top
     once it's scrolled past, as on an iPhone. */
(function () {
  if (window.hubConfirm) return;
  var style = document.createElement("style");
  style.textContent =
    ".hub-dlg{position:fixed;inset:0;z-index:400;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.4);opacity:0;transition:opacity .2s;padding:0 8px max(8px,env(safe-area-inset-bottom));font-family:-apple-system,'SF Pro Text','Helvetica Neue',system-ui,sans-serif}" +
    ".hub-dlg.on{opacity:1}" +
    ".hub-dlg-box{width:100%;max-width:440px;transform:translateY(40px);transition:transform .22s cubic-bezier(.2,.8,.2,1)}" +
    ".hub-dlg.on .hub-dlg-box{transform:none}" +
    ".hub-dlg-card{background:#fff;color:#111827;border-radius:20px;overflow:hidden;text-align:center}" +
    "html.dark .hub-dlg-card{background:#2c2c2e;color:#f9fafb}" +
    ".hub-dlg-text{padding:18px 20px 16px}" +
    ".hub-dlg-title{font-size:16px;font-weight:700;line-height:1.35;white-space:pre-line}" +
    ".hub-dlg-body{margin-top:6px;font-size:14px;line-height:1.4;color:#6b7280;white-space:pre-line}" +
    "html.dark .hub-dlg-body{color:#a1a1aa}" +
    ".hub-dlg-input{display:block;width:100%;box-sizing:border-box;margin-top:12px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;font:inherit;font-size:16px;color:inherit;background:transparent}" +
    "html.dark .hub-dlg-input{border-color:rgba(255,255,255,.15)}" +
    ".hub-dlg-btn{display:block;width:100%;border:0;border-top:1px solid #e5e7eb;background:none;padding:15px;font:inherit;font-size:17px;font-weight:600;color:#15803d;cursor:pointer}" +
    "html.dark .hub-dlg-btn{border-color:rgba(255,255,255,.1);color:#4ade80}" +
    ".hub-dlg-btn.danger{color:#dc2626}" +
    "html.dark .hub-dlg-btn.danger{color:#f87171}" +
    ".hub-dlg-cancel{margin-top:8px;border:0;border-radius:20px;background:#fff;font-weight:700}" +
    "html.dark .hub-dlg-cancel{background:#2c2c2e}" +
    ".hub-toast{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 10px);z-index:450;max-width:calc(100% - 32px);transform:translate(-50%,-80px);display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;background:#111827;color:#fff;font:600 14px/1.3 -apple-system,'SF Pro Text',system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);transition:transform .3s cubic-bezier(.2,.8,.2,1),opacity .3s;opacity:0;pointer-events:none}" +
    "html.dark .hub-toast{background:#f9fafb;color:#111827}" +
    ".hub-toast.on{transform:translate(-50%,0);opacity:1}" +
    ".hub-toast.error{background:#dc2626;color:#fff}" +
    ".hub-toast svg{width:18px;height:18px;flex-shrink:0}" +
    ".hub-lt{position:fixed;left:0;right:0;top:0;z-index:35;padding:max(10px,env(safe-area-inset-top)) 16px 10px;text-align:center;font:700 17px/1.3 -apple-system,'SF Pro Text',system-ui,sans-serif;color:#111827;background:rgba(242,242,247,.85);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);transform:translateY(-100%);transition:transform .2s;pointer-events:none}" +
    "html.dark .hub-lt{color:#f9fafb;background:rgba(0,0,0,.75)}" +
    ".hub-lt.on{transform:none}" +
    "@media (prefers-reduced-motion:reduce){.hub-dlg,.hub-dlg-box,.hub-toast,.hub-lt{transition:none}}";
  document.head.appendChild(style);

  var el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  // the first paragraph is the title, the rest the explanation
  var split = function (message) {
    var text = String(message || "");
    var parts = text.split(/\n\s*\n/);
    if (parts.length > 1) return { title: parts[0], body: parts.slice(1).join("\n\n") };
    // one paragraph: a question first is the title, what follows it the explanation
    var q = text.match(/^([^?]{2,120}\?)\s+([\s\S]+)$/);
    return q ? { title: q[1], body: q[2] } : { title: text, body: "" };
  };
  // something that can't be undone: its button says so, in red
  var DANGER = /^(remove|delete|clear|archive|reset|sign out|leave|stop|turn off|decline|discard|replace|unlink|forget)/i;

  function sheet(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var back = el("div", "hub-dlg");
      back.setAttribute("role", "alertdialog");
      back.setAttribute("aria-modal", "true");
      var box = el("div", "hub-dlg-box");
      var card = el("div", "hub-dlg-card");
      var text = el("div", "hub-dlg-text");
      var m = split(message);
      var title = el("div", "hub-dlg-title", m.title);
      title.id = "hub-dlg-title-" + Date.now();
      back.setAttribute("aria-labelledby", title.id);
      text.appendChild(title);
      if (m.body) text.appendChild(el("div", "hub-dlg-body", m.body));
      var input = null;
      if (opts.input != null) {
        input = el("input", "hub-dlg-input");
        input.value = opts.input;
        text.appendChild(input);
      }
      card.appendChild(text);
      var ok = el("button", "hub-dlg-btn" + (opts.danger ? " danger" : ""), opts.ok || "OK");
      ok.type = "button";
      card.appendChild(ok);
      box.appendChild(card);
      var cancel = null;
      if (opts.cancel !== false) {
        cancel = el("button", "hub-dlg-btn hub-dlg-cancel", opts.cancel || "Cancel");
        cancel.type = "button";
        box.appendChild(cancel);
      }
      back.appendChild(box);
      var before = document.activeElement;
      document.body.appendChild(back);
      requestAnimationFrame(function () { back.classList.add("on"); });
      (input || (opts.danger && cancel) || ok).focus();
      var done = function (value) {
        document.removeEventListener("keydown", onKey, true);
        back.classList.remove("on");
        setTimeout(function () { back.remove(); if (before && before.focus) before.focus(); }, 200);
        resolve(value);
      };
      var yes = function () { done(input ? input.value : true); };
      var no = function () { done(input ? null : opts.cancel === false ? true : false); };
      var onKey = function (e) {
        if (e.key === "Escape") { e.preventDefault(); no(); }
        else if (e.key === "Enter" && (input || document.activeElement === ok)) { e.preventDefault(); yes(); }
      };
      document.addEventListener("keydown", onKey, true);
      ok.addEventListener("click", yes);
      if (cancel) cancel.addEventListener("click", no);
      back.addEventListener("click", function (e) { if (e.target === back) no(); });
      if (opts.danger && window.hubHaptic) window.hubHaptic();
    });
  }

  window.hubConfirm = function (message, opts) {
    opts = opts || {};
    var first = split(message).title.trim();
    var verb = (first.match(DANGER) || [])[0];
    var danger = opts.danger != null ? opts.danger : !!verb;
    var ok = opts.ok || (verb ? verb.charAt(0).toUpperCase() + verb.slice(1).toLowerCase() : "OK");
    return sheet(message, { ok: ok, danger: danger, cancel: opts.cancel });
  };
  window.hubAlert = function (message) {
    return sheet(message, { ok: "OK", cancel: false }).then(function () {});
  };
  window.hubPrompt = function (message, value) {
    return sheet(message, { ok: "OK", input: value == null ? "" : String(value) });
  };

  // ---- toast ----
  var toastEl = null, toastTimer = null;
  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
  var BANG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>';
  window.hubToast = function (text, tone) {
    if (!toastEl) {
      toastEl = el("div", "hub-toast");
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.className = "hub-toast" + (tone === "error" ? " error" : "");
    toastEl.innerHTML = tone === "error" ? BANG : TICK;
    toastEl.appendChild(el("span", "", text));
    clearTimeout(toastTimer);
    requestAnimationFrame(function () { toastEl.classList.add("on"); });
    toastTimer = setTimeout(function () { toastEl.classList.remove("on"); }, tone === "error" ? 3500 : 2000);
  };

  // ---- large titles shrink into a bar once scrolled past ----
  var bar = null, watched = null, observer = null;
  var watch = function () {
    var t = document.querySelector("[data-large-title]");
    if (t === watched) return;
    if (observer) observer.disconnect();
    watched = t;
    if (!t || !("IntersectionObserver" in window)) { if (bar) bar.classList.remove("on"); return; }
    if (!bar) { bar = el("div", "hub-lt"); bar.setAttribute("aria-hidden", "true"); document.body.appendChild(bar); }
    // the title's own words (React writes a bare attribute as "true")
    var named = t.getAttribute("data-large-title");
    bar.textContent = named && named !== "true" ? named : (t.textContent || "").trim();
    bar.classList.remove("on");
    observer = new IntersectionObserver(function (entries) {
      var e = entries[0];
      bar.classList.toggle("on", !e.isIntersecting && e.boundingClientRect.top < 0);
    }, { rootMargin: "-40px 0px 0px 0px" });
    observer.observe(t);
  };
  // pages come and go without a reload in the app's own routes
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; watch(); });
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
})();
