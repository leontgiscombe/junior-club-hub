/* The club switcher on the pages that aren't React (Finances, the Training
   Hub): the header's crest, marked data-club-switcher, opens Your Clubs —
   every club the account is in, to switch with a tap, Join another club and
   Add or manage children. The same as app/components/ClubSwitcher.tsx: it
   only shows for someone signed in on the platform (/api/me/clubs), slides up
   over the tab bar and is swiped down to close. */
(function () {
  var crest = document.querySelector('[data-club-switcher]');
  if (!crest) return;
  fetch('/api/me/clubs', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      // a single-club hub has no opening screen to switch through
      if (!data || !/^https?:\/\//.test(data.start || '')) return;
      setUp(data);
    })
    .catch(function () {});

  var css =
    '.cs-btn{position:relative;display:inline-block;padding:0;border:0;background:none;cursor:pointer;line-height:0}' +
    '.cs-chev{position:absolute;right:-4px;bottom:-4px;width:20px;height:20px;border-radius:50%;background:#fff;color:#4b5563;display:grid;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.2),0 0 0 1px rgba(0,0,0,.08)}' +
    'html.dark .cs-chev{background:#2c2c2e;color:#e5e7eb}' +
    '.cs-back{position:fixed;inset:0;z-index:300;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.4);opacity:0;transition:opacity .2s;overscroll-behavior:contain}' +
    '.cs-back.on{opacity:1}' +
    '.cs-sheet{width:100%;max-width:576px;box-sizing:border-box;background:#fff;color:#111827;border-radius:24px 24px 0 0;padding:12px 20px max(20px,env(safe-area-inset-bottom));box-shadow:0 -10px 30px rgba(0,0,0,.15);transform:translateY(600px);transition:transform .2s ease-out;touch-action:none;user-select:none;-webkit-user-select:none;font-family:-apple-system,"SF Pro Text","Helvetica Neue",system-ui,sans-serif}' +
    'html.dark .cs-sheet{background:#1c1c1e;color:#f9fafb}' +
    '.cs-grab{width:40px;height:6px;border-radius:3px;background:#d1d5db;margin:0 auto 12px}' +
    'html.dark .cs-grab{background:rgba(255,255,255,.2)}' +
    '.cs-sheet h2{margin:0;font-size:18px;font-weight:800}' +
    '.cs-list{margin-top:12px}' +
    '.cs-row{display:flex;align-items:center;gap:16px;padding:12px 0;width:100%;border:0;background:none;color:inherit;font:inherit;text-align:left;text-decoration:none;cursor:pointer;border-top:1px solid #f3f4f6}' +
    '.cs-row:first-child{border-top:0}' +
    'html.dark .cs-row{border-color:rgba(255,255,255,.1)}' +
    '.cs-row img{width:48px;height:48px;flex-shrink:0;border-radius:12px;object-fit:contain;box-shadow:0 0 0 1px rgba(0,0,0,.05)}' +
    '.cs-name{flex:1;min-width:0}' +
    '.cs-name b{display:block;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.cs-name span{display:block;font-size:14px;color:#6b7280}' +
    'html.dark .cs-name span{color:#9ca3af}' +
    '.cs-act{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;padding:14px 16px;border-radius:16px;background:#f0fdf4;color:#166534;font-weight:700;text-decoration:none}' +
    'html.dark .cs-act{background:rgba(74,222,128,.1);color:#86efac}' +
    '.cs-note{padding:16px 0;font-size:14px;color:#6b7280}';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function setUp(data) {
    var style = el('style');
    style.textContent = css;
    document.head.appendChild(style);
    // the crest becomes a button, with a little ⌄ to say so
    var btn = el('button', 'cs-btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Your clubs');
    btn.setAttribute('aria-haspopup', 'dialog');
    crest.parentNode.insertBefore(btn, crest);
    btn.appendChild(crest);
    var chev = el('span', 'cs-chev');
    chev.setAttribute('aria-hidden', 'true');
    chev.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
    btn.appendChild(chev);
    btn.addEventListener('click', function () { open(data); });
  }

  function open(data) {
    var back = el('div', 'cs-back');
    var sheet = el('div', 'cs-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Your clubs');
    sheet.appendChild(el('div', 'cs-grab'));
    sheet.appendChild(el('h2', '', 'Your Clubs'));
    var list = el('div', 'cs-list');
    if (!data.clubs.length) list.appendChild(el('p', 'cs-note', 'No clubs yet.'));
    data.clubs.forEach(function (c) {
      var row = el(c.current ? 'button' : 'a', 'cs-row');
      if (c.current) { row.type = 'button'; row.addEventListener('click', close); }
      else row.href = data.start + '?go=' + encodeURIComponent(c.home) + '&name=' + encodeURIComponent(c.name);
      var img = el('img');
      img.src = c.crest;
      img.alt = '';
      row.appendChild(img);
      var name = el('span', 'cs-name');
      name.appendChild(el('b', '', c.name));
      if (c.current || c.waiting) name.appendChild(el('span', '', c.waiting ? 'Waiting for approval' : 'You’re here'));
      row.appendChild(name);
      row.insertAdjacentHTML('beforeend', c.current
        ? '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Current club"><path d="m5 12 5 5 9-10"/></svg>'
        : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#9ca3af" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>');
      list.appendChild(row);
    });
    sheet.appendChild(list);
    var join = el('a', 'cs-act', '+ Join another club');
    join.href = data.start + '?pick=1&join=1';
    sheet.appendChild(join);
    var kids = el('a', 'cs-act', 'Add or manage children');
    kids.href = '/account';
    sheet.appendChild(kids);
    back.appendChild(sheet);
    document.body.appendChild(back);

    // the tab bar hides while it's open
    var bar = document.getElementById('hub-tabbar');
    var barShown = bar ? bar.style.display : '';
    if (bar) bar.style.display = 'none';
    requestAnimationFrame(function () {
      back.classList.add('on');
      sheet.style.transform = 'translateY(0)';
    });

    function close() {
      back.classList.remove('on');
      sheet.style.transition = 'transform .2s ease-out';
      sheet.style.transform = 'translateY(600px)';
      document.removeEventListener('keydown', onKey);
      setTimeout(function () {
        back.remove();
        if (bar) bar.style.display = barShown;
      }, 200);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });

    // swiping down: follows the finger, closes on a long or quick swipe
    var start = null, dragged = false;
    sheet.addEventListener('pointerdown', function (e) { start = { y: e.clientY, t: Date.now(), moved: false }; dragged = false; });
    sheet.addEventListener('pointermove', function (e) {
      if (!start) return;
      var dy = e.clientY - start.y;
      if (!start.moved && Math.abs(dy) < 8) return;
      if (!start.moved) {
        start.moved = dragged = true;
        sheet.style.transition = 'none';
        sheet.setPointerCapture(e.pointerId);
      }
      sheet.style.transform = 'translateY(' + (dy > 0 ? dy : dy / 4) + 'px)';
    });
    function up(e) {
      var s = start;
      start = null;
      if (!s || !s.moved) return;
      var dy = e.clientY - s.y;
      var fast = dy / Math.max(Date.now() - s.t, 1) > 0.5;
      if (dy > 100 || (dy > 30 && fast)) close();
      else {
        sheet.style.transition = 'transform .2s ease-out';
        sheet.style.transform = 'translateY(0)';
      }
    }
    sheet.addEventListener('pointerup', up);
    sheet.addEventListener('pointercancel', up);
    // a drag isn't a tap on whatever it started on
    sheet.addEventListener('click', function (e) {
      if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; }
    }, true);
  }
})();
