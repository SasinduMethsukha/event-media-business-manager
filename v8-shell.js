/* Event Media OS v8 — one app, one side menu.
 *
 * The document editor and the Business Manager used to be two separate
 * screens with their own tab strips. This shell puts every screen in one
 * grouped side menu, shows the page title and only the relevant actions in
 * the top bar, and adds editor conveniences (section jump bar, collapsible
 * company details, live total). It only calls the existing showPane() /
 * showManagerPane() functions, so no screen's behaviour changes.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function has(fn) { return typeof window[fn] === 'function'; }
  function isAdmin() { return has('isProfileAdmin') ? window.isProfileAdmin() : true; }
  function isOwner() { return has('isTeamOwner') ? window.isTeamOwner() : isAdmin(); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // kind: 'editor' pages live in the editor sidebar; 'manager' pages are
  // Business Manager panes. staff: visible to employee profiles.
  var NAV = [
    { group: 'Documents', items: [
      { id: 'editor', kind: 'editor', icon: 'ti-file-pencil', label: 'Document editor' },
      { id: 'history', kind: 'editor', icon: 'ti-files', label: 'Saved documents' },
      { id: 'fxquotes', kind: 'manager', icon: 'ti-file-check', label: 'Quotation pipeline' },
      { id: 'templates', kind: 'editor', icon: 'ti-layout-grid', label: 'Templates' }
    ] },
    { group: 'Money', items: [
      { id: 'dashboard', kind: 'manager', icon: 'ti-layout-dashboard', label: 'Dashboard' },
      { id: 'invoices', kind: 'manager', icon: 'ti-file-invoice', label: 'Invoices' },
      { id: 'payments', kind: 'manager', icon: 'ti-receipt', label: 'Payments received' },
      { id: 'fxreceivables', kind: 'manager', icon: 'ti-clock-dollar', label: 'Receivables' },
      { id: 'fx2payables', kind: 'manager', icon: 'ti-cash-banknote', label: 'Payables' },
      { id: 'finance', kind: 'manager', icon: 'ti-coins', label: 'Finance & expenses' },
      { id: 'reports', kind: 'manager', icon: 'ti-chart-bar', label: 'Monthly report' },
      { id: 'fx2pl', kind: 'manager', icon: 'ti-chart-line', label: 'Profit & tax' }
    ] },
    { group: 'Operations', items: [
      { id: 'fx2events', kind: 'manager', icon: 'ti-calendar-event', label: 'Events' },
      { id: 'rentals', kind: 'manager', icon: 'ti-truck-delivery', label: 'Supplier rentals', staff: true },
      { id: 'equipmenthire', kind: 'manager', icon: 'ti-package-export', label: 'Equipment hire', staff: true },
      { id: 'fxinventory', kind: 'manager', icon: 'ti-packages', label: 'Inventory' },
      { id: 'fx2crew', kind: 'manager', icon: 'ti-users-group', label: 'Crew' },
      { id: 'fxclients', kind: 'manager', icon: 'ti-address-book', label: 'Clients' },
      { id: 'fx2files', kind: 'manager', icon: 'ti-paperclip', label: 'Files' }
    ] },
    { group: 'Workspace', items: [
      { id: 'cloud', kind: 'editor', icon: 'ti-cloud', label: 'Cloud & sync', owner: true },
      { id: 'gsheets', kind: 'editor', icon: 'ti-table', label: 'Google Sheets', owner: true },
      { id: 'profiles', kind: 'manager', icon: 'ti-users', label: 'Team', owner: true },
      { id: 'fx2audit', kind: 'manager', icon: 'ti-list-search', label: 'Activity log', owner: true },
      { id: 'database', kind: 'manager', icon: 'ti-database', label: 'Database viewer', owner: true },
      { id: 'admin', kind: 'manager', icon: 'ti-shield-cog', label: 'Edit records', owner: true },
      { id: 'setup', kind: 'manager', icon: 'ti-database-cog', label: 'Database setup', owner: true }
    ] }
  ];
  var BY_ID = {};
  NAV.forEach(function (g) { g.items.forEach(function (it) { it.group = g.group; BY_ID[it.id] = it; }); });

  // ── Navigation ─────────────────────────────────────────────────────
  function managerOpen() { var mv = $('managerView'); return !!(mv && mv.style.display !== 'none'); }
  function go(id) {
    var it = BY_ID[id];
    if (!it) return;
    if (!isAdmin() && !it.staff) id = 'rentals', it = BY_ID.rentals;
    else if (it.owner && !isOwner()) id = 'dashboard', it = BY_ID.dashboard;
    if (it.kind === 'editor') {
      if (managerOpen() && has('closeManager')) window.closeManager();
      window.showPane(id);
    } else {
      if (!managerOpen() && has('openManager')) window.openManager();
      window.showManagerPane(id);
    }
    closeDrawer();
    window.scrollTo(0, 0);
    sync();
  }
  window.v8Go = go;

  function currentPage() {
    if (managerOpen()) {
      var panes = document.querySelectorAll('#managerView > [id^="managerPane-"]');
      for (var i = 0; i < panes.length; i++) if (panes[i].style.display !== 'none') return panes[i].id.replace('managerPane-', '');
      return 'dashboard';
    }
    var ed = document.querySelectorAll('.sidebar > [id^="pane-"]');
    for (var j = 0; j < ed.length; j++) if (ed[j].style.display !== 'none') return ed[j].id.replace('pane-', '');
    return 'editor';
  }

  function buildNav() {
    var list = $('v8NavList');
    if (!list) return;
    var admin = isAdmin(), owner = isOwner();
    list.innerHTML = NAV.map(function (g) {
      var items = g.items.filter(function (it) { return admin ? (!it.owner || owner) : it.staff; });
      if (!items.length) return '';
      return '<div class="v8-group"><div class="v8-group-label">' + g.group + '</div>' + items.map(function (it) {
        return '<button type="button" class="v8-item" data-nav="' + it.id + '"><i class="ti ' + it.icon + '" aria-hidden="true"></i><span>' + it.label + '</span>' +
          (it.id === 'editor' ? '<span class="v8-unsaved" title="Unsaved changes" aria-label="Unsaved changes" hidden></span>' : '') + '</button>';
      }).join('') + '</div>';
    }).join('');
    sync();
  }

  function sync() {
    var page = currentPage(), it = BY_ID[page];
    document.querySelectorAll('.v8-item').forEach(function (b) {
      var on = b.getAttribute('data-nav') === page;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var editorish = !managerOpen() && page === 'editor';
    var title = it ? it.label : 'Document editor';
    if (editorish) {
      var type = (window.gv && window.gv('docType')) || 'Quotation', num = window.gv && window.gv('docNum');
      title = type;
      if ($('v8Crumb')) $('v8Crumb').textContent = num && num !== '…' ? '#' + num : '';
    } else if ($('v8Crumb')) {
      $('v8Crumb').textContent = it ? it.group : '';
    }
    if ($('v8Title')) $('v8Title').textContent = title;
    document.title = title + ' — Event Media OS';
    document.querySelectorAll('.v8-ctx').forEach(function (c) {
      var ctx = c.getAttribute('data-ctx');
      c.hidden = ctx === 'editor' ? managerOpen() : !managerOpen();
    });
    document.body.classList.toggle('v8-in-manager', managerOpen());
    document.body.classList.toggle('v8-page-editor', editorish);
  }
  window.v8Sync = sync;

  ['showPane', 'showManagerPane', 'openManager', 'closeManager', 'applyProfileAccess', 'profileLogout'].forEach(function (name) {
    if (!has(name)) return;
    var orig = window[name];
    window[name] = function () {
      var r = orig.apply(this, arguments);
      if (name === 'applyProfileAccess' || name === 'profileLogout') buildNav(); else sync();
      return r;
    };
  });

  // Keep the title (#number) and the unsaved dot current.
  if (has('markDocDirty')) {
    var d0 = window.markDocDirty;
    window.markDocDirty = function () { var r = d0.apply(this, arguments); unsavedDot(true); scheduleSync(); return r; };
  }
  if (has('markDocClean')) {
    var c0 = window.markDocClean;
    window.markDocClean = function () { var r = c0.apply(this, arguments); unsavedDot(false); scheduleSync(); return r; };
  }
  function unsavedDot(on) { document.querySelectorAll('.v8-unsaved').forEach(function (d) { d.hidden = !on; }); }
  var syncTimer = null;
  function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(function () { sync(); updateTotalBar(); }, 120); }

  // ── New document menu ──────────────────────────────────────────────
  var NEW_TYPES = [
    ['Quotation', 'ti-file-description'], ['Invoice', 'ti-file-invoice'], ['Proforma Invoice', 'ti-file-dollar'],
    ['Purchase Order', 'ti-shopping-cart'], ['Credit Note', 'ti-receipt-refund']
  ];
  async function newDocument(type) {
    if (has('isDocDirty') && window.isDocDirty() && window.__editorReady &&
        !window.confirm('You have unsaved changes in the current document.\n\nStart a new ' + type + ' anyway? (A draft copy is kept on this device.)')) return;
    go('editor');
    ['clientName', 'clientContact', 'clientEmail', 'clientAddr', 'eventName', 'eventLocation'].forEach(function (id) { var e = $(id); if (e) e.value = ''; });
    var pick = $('fxClientPick'); if (pick) pick.value = '';
    window.eventDates = [''];
    if (has('renderEventDates')) window.renderEventDates();
    var today = window.localISODate ? window.localISODate() : new Date().toISOString().slice(0, 10);
    $('issueDate').value = today;
    $('dueDate').value = window.addDaysISO ? window.addDaysISO(today, 30) : today;
    ['advEnabled', 'wordsEnabled'].forEach(function (id) { var e = $(id); if (e) e.checked = false; });
    if (has('toggleField') && $('advFields')) window.toggleField('advFields', false);
    window.cats = []; window.catId = 0;
    window.addCategory({ name: 'Services' });
    $('docType').value = type;
    window.docNumManual = false;
    if (has('onDocTypeChange')) await window.onDocTypeChange();
    if (has('markDocClean')) window.markDocClean();
    var first = $('clientName'); if (first) { first.scrollIntoView({ block: 'center' }); first.focus(); }
    if (has('showToast')) window.showToast('New ' + type + ' ' + (window.gv ? window.gv('docNum') : '') + ' started. Fill in the client, then add your items.', 'success');
  }
  window.newDocument = newDocument;

  function toggleMenu(btn, menu, open) {
    if (!btn || !menu) return;
    var on = open === undefined ? menu.hidden : open;
    document.querySelectorAll('.v8-new-menu, .v8-more-menu').forEach(function (m) { if (m !== menu) m.hidden = true; });
    document.querySelectorAll('#v8NewBtn, #v8MoreBtn').forEach(function (b) { if (b !== btn) b.setAttribute('aria-expanded', 'false'); });
    menu.hidden = !on;
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) { var f = menu.querySelector('button'); if (f) f.focus(); }
  }
  function buildNewMenu() {
    var m = $('v8NewMenu');
    if (!m) return;
    m.innerHTML = NEW_TYPES.map(function (t) { return '<button type="button" role="menuitem" data-new="' + t[0] + '"><i class="ti ' + t[1] + '"></i> ' + t[0] + '</button>'; }).join('') +
      '<div class="v8-menu-sep"></div><button type="button" role="menuitem" data-tpl="1"><i class="ti ti-layout-grid"></i> From a template…</button>';
    m.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      toggleMenu($('v8NewBtn'), m, false);
      if (b.dataset.tpl) go('templates'); else newDocument(b.dataset.new);
    });
    $('v8NewBtn').addEventListener('click', function (e) { e.stopPropagation(); toggleMenu($('v8NewBtn'), m); });
    var more = $('v8MoreMenu'), moreBtn = $('v8MoreBtn');
    if (more && moreBtn) {
      moreBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu(moreBtn, more); });
      more.addEventListener('click', function () { toggleMenu(moreBtn, more, false); });
    }
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.v8-new-wrap, .v8-more')) { toggleMenu($('v8NewBtn'), m, false); if (more) toggleMenu(moreBtn, more, false); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!m.hidden) { toggleMenu($('v8NewBtn'), m, false); $('v8NewBtn').focus(); }
      if (more && !more.hidden) { toggleMenu(moreBtn, more, false); moreBtn.focus(); }
      if (document.body.classList.contains('v8-drawer-open')) closeDrawer();
    });
  }

  // ── Phone drawer ───────────────────────────────────────────────────
  function openDrawer() { document.body.classList.add('v8-drawer-open'); $('v8Scrim').hidden = false; $('v8MenuBtn').setAttribute('aria-expanded', 'true'); var a = document.querySelector('.v8-item.is-active') || document.querySelector('.v8-item'); if (a) a.focus(); }
  function closeDrawer() { if (!document.body.classList.contains('v8-drawer-open')) return; document.body.classList.remove('v8-drawer-open'); $('v8Scrim').hidden = true; $('v8MenuBtn').setAttribute('aria-expanded', 'false'); }

  // ── Editor: section jump bar, collapsible company, live total ─────
  var SECTIONS = [
    { key: 'company', match: /^(logo|your company)/i, label: 'Company', collapsible: true },
    { key: 'document', match: /^document/i, label: 'Document' },
    { key: 'event', match: /event/i, label: 'Event' },
    { key: 'client', match: /^client/i, label: 'Client' },
    { key: 'items', match: /categor|items|line/i, label: 'Items' },
    { key: 'pricing', match: /adjust|pricing/i, label: 'Pricing' },
    { key: 'sign', match: /signator/i, label: 'Sign-off' },
    { key: 'payment', match: /payment/i, label: 'Payment' }
  ];
  function sectionize() {
    var pane = $('pane-editor');
    if (!pane || pane.dataset.v8) return;
    pane.dataset.v8 = '1';
    var kids = Array.prototype.slice.call(pane.children);
    var groups = [], cur = null;
    kids.forEach(function (el) {
      if (el.id === 'draftBanner') return;
      if (el.classList && el.classList.contains('section-label')) {
        var text = (el.textContent || '').trim();
        var def = SECTIONS.filter(function (s) { return s.match.test(text); })[0];
        var key = def ? def.key : 'other';
        // Logo + Your company share one "Company" section.
        if (cur && cur.key === key) { cur.els.push(el); return; }
        cur = { key: key, def: def, els: [el] };
        groups.push(cur);
      } else if (cur) cur.els.push(el);
    });
    groups.forEach(function (g) {
      var sec = document.createElement('section');
      sec.className = 'v8-sec';
      sec.id = 'v8sec-' + g.key;
      sec.dataset.key = g.key;
      g.els[0].parentNode.insertBefore(sec, g.els[0]);
      g.els.forEach(function (el) { sec.appendChild(el); });
      if (g.def && g.def.collapsible) {
        var body = document.createElement('div');
        body.className = 'v8-sec-body';
        while (sec.firstChild) body.appendChild(sec.firstChild);
        var head = document.createElement('button');
        head.type = 'button';
        head.className = 'v8-sec-toggle';
        head.setAttribute('aria-expanded', 'false');
        head.setAttribute('aria-controls', 'v8sec-body-' + g.key);
        body.id = 'v8sec-body-' + g.key;
        sec.appendChild(head); sec.appendChild(body);
        var summary = function () {
          var n = window.gv ? window.gv('coName') : '';
          head.innerHTML = '<span><strong>Company details</strong><small>' + (n ? (window.esc ? window.esc(n) : n) + ', logo, contact and address' : 'Logo, contact and address') + '</small></span><i class="ti ti-chevron-down" aria-hidden="true"></i>';
        };
        var open = lsGet('eventmedia:v8:companyOpen') === '1';
        var set = function (o) { sec.classList.toggle('is-open', o); head.setAttribute('aria-expanded', o ? 'true' : 'false'); lsSet('eventmedia:v8:companyOpen', o ? '1' : '0'); };
        summary(); set(open);
        head.addEventListener('click', function () { set(!sec.classList.contains('is-open')); summary(); });
      }
    });
    // Jump bar
    var bar = document.createElement('div');
    bar.className = 'v8-jump';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Editor sections');
    bar.innerHTML = groups.filter(function (g) { return g.def; }).map(function (g) {
      return '<button type="button" data-jump="' + g.key + '">' + g.def.label + '</button>';
    }).join('');
    pane.insertBefore(bar, pane.firstChild);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-jump]'); if (!b) return;
      var sec = $('v8sec-' + b.dataset.jump); if (!sec) return;
      if (sec.querySelector('.v8-sec-toggle') && !sec.classList.contains('is-open')) sec.querySelector('.v8-sec-toggle').click();
      var sb = document.querySelector('.sidebar');
      var scroller = (sb && sb.scrollHeight > sb.clientHeight + 4 && getComputedStyle(sb).overflowY !== 'visible') ? sb : null;
      var offset = bar.offsetHeight + 8;
      if (scroller) scroller.scrollTo({ top: sec.offsetTop - offset, behavior: 'smooth' });
      else window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - offset - 70, behavior: 'smooth' });
    });
    // Highlight the section in view
    var sb = document.querySelector('.sidebar');
    var onScroll = function () {
      var top = bar.getBoundingClientRect().bottom + 20, current = null;
      pane.querySelectorAll('.v8-sec').forEach(function (s) { if (s.getBoundingClientRect().top <= top) current = s.dataset.key; });
      bar.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-on', b.dataset.jump === current); });
    };
    if (sb) sb.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Live total footer
    var tb = document.createElement('div');
    tb.className = 'v8-totalbar';
    tb.id = 'v8TotalBar';
    tb.innerHTML = '<div><small id="v8TbMeta"></small><strong id="v8TbTotal"></strong></div><button type="button" class="btn btn-sm" id="v8TbItems"><i class="ti ti-plus"></i> Add item</button>';
    pane.appendChild(tb);
    $('v8TbItems').onclick = function () {
      var cats = window.cats || [];
      var c = cats.filter(function (x) { return (x.type || 'standard') === 'standard'; }).pop() || cats[cats.length - 1];
      if (!c) { window.addCategory(null); return; }
      window.addItem(c.id);
      setTimeout(function () {
        var rows = document.querySelectorAll('tr.item-row[data-cid="' + c.id + '"] .item-cell-desc input');
        var last = rows[rows.length - 1]; if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); last.focus(); }
      }, 30);
    };
    updateTotalBar();
  }
  function updateTotalBar() {
    if (!$('v8TbTotal') || !has('calcTotals')) return;
    try {
      var t = window.calcTotals();
      var items = (window.cats || []).reduce(function (s, c) { return s + (c.items || []).length; }, 0);
      $('v8TbTotal').textContent = window.fmt(t.grand);
      $('v8TbMeta').textContent = ((window.gv && window.gv('docType')) || 'Document') + ' total, ' + items + ' line' + (items === 1 ? '' : 's');
    } catch (e) {}
  }
  if (has('renderNow')) {
    var rn = window.renderNow;
    window.renderNow = function () { var r = rn.apply(this, arguments); updateTotalBar(); return r; };
  }

  // ── Boot ───────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('v8');
    buildNav();
    buildNewMenu();
    $('v8NavList').addEventListener('click', function (e) { var b = e.target.closest('[data-nav]'); if (b) go(b.getAttribute('data-nav')); });
    $('v8MenuBtn').addEventListener('click', function () { document.body.classList.contains('v8-drawer-open') ? closeDrawer() : openDrawer(); });
    $('v8Scrim').addEventListener('click', closeDrawer);
    sectionize();
    sync();
  });
  document.addEventListener('editor:ready', function () { updateTotalBar(); sync(); });
})();
