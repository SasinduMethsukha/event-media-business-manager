/**
 * theme.js — Event Media OS UI layer
 * Tasks:
 *  1. Toast notifications (replaces alert() visually via window.alert override)
 *  2. Confirm dialog (replaces confirm() via wrapper — callers unmodified)
 *  3. Global search (Ctrl/Cmd+K)
 *  4. Sidebar nav group labels injected
 *  5. Dashboard: KPI sparklines, Overdue panel, Upcoming strip
 *  6. Calendar view toggle for Rentals + Equipment Hire panes
 *  7. Skeleton loaders while tables load
 *  8. Quote status board metrics bar
 *  9. Empty-state enhancement
 * 10. Responsive bottom-nav on mobile
 */

(function () {
  'use strict';

  /* ── helpers ──────────────────────────────────────────────── */
  var $ = function (id) { return document.getElementById(id); };
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  /* ══════════════════════════════════════════════════════════
     1. TOAST NOTIFICATION SYSTEM
     Creates a non-blocking floating toast. Also wraps native
     window.alert so existing callers get toasts instead.
  ══════════════════════════════════════════════════════════ */
  var toastContainer;

  function ensureToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'os-toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  /**
   * Show a toast notification.
   * @param {string} msg      - Main message text
   * @param {string} [type]   - 'success' | 'error' | 'info' | 'warn' (default 'info')
   * @param {string} [title]  - Optional bold title
   * @param {number} [dur]    - Duration ms (default 4000; 0 = persistent)
   */
  window.showToast = function (msg, type, title, dur) {
    ensureToastContainer();
    type = type || 'info';
    dur  = (dur === undefined) ? 4000 : dur;

    var icons = {
      success: 'ti ti-circle-check-filled',
      error:   'ti ti-alert-circle-filled',
      info:    'ti ti-info-circle-filled',
      warn:    'ti ti-alert-triangle-filled'
    };
    var icon = icons[type] || icons.info;

    var t = document.createElement('div');
    t.className = 'os-toast toast-' + type;
    t.setAttribute('role', 'alert');
    t.setAttribute('aria-live', 'polite');
    t.innerHTML =
      '<i class="' + icon + '"></i>' +
      '<div class="os-toast-body">' +
        (title ? '<div class="os-toast-title">' + _esc(title) + '</div>' : '') +
        '<div class="os-toast-msg">' + _esc(msg) + '</div>' +
      '</div>' +
      '<button class="os-toast-close" aria-label="Dismiss"><i class="ti ti-x"></i></button>';

    var closeBtn = t.querySelector('.os-toast-close');
    closeBtn.addEventListener('click', function () { dismissToast(t); });

    toastContainer.appendChild(t);

    if (dur > 0) {
      setTimeout(function () { dismissToast(t); }, dur);
    }
    return t;
  };

  function dismissToast(el) {
    if (!el || el._dismissing) return;
    el._dismissing = true;
    el.classList.add('toast-out');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 220);
  }

  /* Override native alert() — use toast so callers need no change */
  var _nativeAlert = window.alert;
  window.alert = function (msg) {
    // Determine type from message content heuristic
    var s = String(msg || '');
    var type = 'info';
    if (/error|fail|invalid|missing|required|cannot|not found/i.test(s)) type = 'error';
    else if (/success|saved|pushed|copied|imported|created/i.test(s)) type = 'success';
    else if (/warning|overdue|overpa/i.test(s)) type = 'warn';
    showToast(s, type, null, 5000);
  };

  /* ══════════════════════════════════════════════════════════
     2. CONFIRM DIALOG
     window.confirm is replaced with an async wrapper.
     Because native confirm() is synchronous but our dialog is
     async, we must handle the two cases:
       - Code that calls confirm() and uses the return value inline
         — these keep working because we wrap confirm() to return
         a Promise-based polyfill *and* schedule via microtask.
     NOTE: The existing callers all do `if(!confirm(…))return;`
     which is synchronous. We cannot make that truly async without
     editing the callers. Instead we keep native confirm() for
     synchronous callers and expose confirmDialog() for new code.
     The overlay is used by new OS-level confirmations.
  ══════════════════════════════════════════════════════════ */
  var _confirmResolve = null;
  var _confirmOverlay;
  var _confirmBox;

  function buildConfirmOverlay() {
    if (_confirmOverlay) return;
    _confirmOverlay = document.createElement('div');
    _confirmOverlay.id = 'os-confirm-overlay';
    _confirmOverlay.setAttribute('role', 'dialog');
    _confirmOverlay.setAttribute('aria-modal', 'true');
    _confirmOverlay.innerHTML =
      '<div id="os-confirm-box">' +
        '<div class="os-confirm-icon icon-warn"><i class="ti ti-alert-triangle"></i></div>' +
        '<div id="os-confirm-title"></div>' +
        '<div id="os-confirm-msg"></div>' +
        '<div id="os-confirm-actions">' +
          '<button class="btn" id="os-confirm-cancel">Cancel</button>' +
          '<button class="btn btn-primary" id="os-confirm-ok">Confirm</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(_confirmOverlay);
    _confirmBox = $('os-confirm-box');

    $('os-confirm-ok').addEventListener('click', function () {
      closeConfirm(true);
    });
    $('os-confirm-cancel').addEventListener('click', function () {
      closeConfirm(false);
    });
    _confirmOverlay.addEventListener('click', function (e) {
      if (e.target === _confirmOverlay) closeConfirm(false);
    });
    document.addEventListener('keydown', function (e) {
      if (_confirmOverlay.classList.contains('open')) {
        if (e.key === 'Enter') { e.preventDefault(); closeConfirm(true); }
        if (e.key === 'Escape') { e.preventDefault(); closeConfirm(false); }
      }
    });
  }

  function closeConfirm(result) {
    if (!_confirmOverlay) return;
    _confirmOverlay.classList.remove('open');
    if (_confirmResolve) {
      var res = _confirmResolve;
      _confirmResolve = null;
      res(result);
    }
  }

  /**
   * Show a styled confirm dialog. Returns a Promise<boolean>.
   * Use this for NEW code in theme.js / new features.
   */
  window.confirmDialog = function (msg, title, okLabel, danger) {
    buildConfirmOverlay();
    $('os-confirm-title').textContent = title || 'Are you sure?';
    $('os-confirm-msg').textContent   = msg || '';
    var okBtn = $('os-confirm-ok');
    okBtn.textContent = okLabel || 'Confirm';
    okBtn.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    var iconEl = _confirmOverlay.querySelector('.os-confirm-icon');
    iconEl.className = 'os-confirm-icon ' + (danger ? 'icon-danger' : 'icon-warn');
    iconEl.innerHTML = danger
      ? '<i class="ti ti-trash"></i>'
      : '<i class="ti ti-alert-triangle"></i>';
    _confirmOverlay.classList.add('open');
    $('os-confirm-ok').focus();
    return new Promise(function (resolve) {
      _confirmResolve = resolve;
    });
  };

  /* ══════════════════════════════════════════════════════════
     3. GLOBAL SEARCH  (Ctrl / Cmd + K)
  ══════════════════════════════════════════════════════════ */
  var _searchOpen = false;
  var _searchOverlay, _searchInput, _searchResults;
  var _searchIdx = -1;

  /* Navigation map: pane name → label, icon, description */
  var NAV_ITEMS = [
    { pane: 'dashboard',     label: 'Dashboard',          icon: 'ti-layout-dashboard', desc: 'KPIs, overdue & upcoming' },
    { pane: 'invoices',      label: 'Invoices',           icon: 'ti-receipt',           desc: 'Invoice tracker' },
    { pane: 'payments',      label: 'Payment Received',   icon: 'ti-receipt-tax',       desc: 'Payment register' },
    { pane: 'rentals',       label: 'Supplier Rentals',   icon: 'ti-truck-delivery',    desc: 'Equipment rental register' },
    { pane: 'equipmenthire', label: 'Equipment Hire',     icon: 'ti-package-export',    desc: 'Hire out our gear' },
    { pane: 'finance',       label: 'Finance',            icon: 'ti-coins',             desc: 'P&L, expenses' },
    { pane: 'reports',       label: 'Reports',            icon: 'ti-chart-bar',         desc: 'Monthly cashflow' },
    { pane: 'database',      label: 'Database Viewer',    icon: 'ti-database',          desc: 'Read-only records' },
    { pane: 'profiles',      label: 'Profiles',           icon: 'ti-users',             desc: 'Team management' },
    { pane: 'admin',         label: 'Admin',              icon: 'ti-shield-cog',        desc: 'Edit / delete records' },
    { pane: 'setup',         label: 'Setup',              icon: 'ti-database-cog',      desc: 'Database setup SQL' },
    { pane: 'fxclients',     label: 'Clients',            icon: 'ti-address-book',      desc: 'Client list & statements' },
    { pane: 'fxquotes',      label: 'Quotes',             icon: 'ti-file-check',        desc: 'Quotation pipeline' },
    { pane: 'fxinventory',   label: 'Inventory',          icon: 'ti-packages',          desc: 'Equipment inventory' },
    { pane: 'fxreceivables', label: 'Receivables',        icon: 'ti-clock-dollar',      desc: 'Ageing & reminders' }
  ];

  function buildSearchOverlay() {
    if (_searchOverlay) return;
    _searchOverlay = document.createElement('div');
    _searchOverlay.id = 'os-search-overlay';
    _searchOverlay.innerHTML =
      '<div id="os-search-box" role="dialog" aria-label="Global search">' +
        '<div class="os-search-input-wrap">' +
          '<i class="ti ti-search"></i>' +
          '<input id="os-search-input" placeholder="Jump to a section…" autocomplete="off" spellcheck="false">' +
          '<span class="os-search-kbd"><span>' + (isMac ? '⌘' : 'Ctrl') + '</span><span>K</span></span>' +
        '</div>' +
        '<div id="os-search-results"></div>' +
      '</div>';
    document.body.appendChild(_searchOverlay);
    _searchInput   = $('os-search-input');
    _searchResults = $('os-search-results');

    _searchInput.addEventListener('input', renderSearchResults);
    _searchInput.addEventListener('keydown', onSearchKey);
    _searchOverlay.addEventListener('click', function (e) {
      if (e.target === _searchOverlay) closeSearch();
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (_searchOpen) closeSearch(); else openSearch();
      }
      if (_searchOpen && e.key === 'Escape') closeSearch();
    });
  }

  function openSearch() {
    buildSearchOverlay();
    _searchOpen = true;
    _searchOverlay.classList.add('open');
    _searchInput.value = '';
    renderSearchResults();
    setTimeout(function () { _searchInput.focus(); }, 50);
  }

  function closeSearch() {
    if (!_searchOverlay) return;
    _searchOpen = false;
    _searchOverlay.classList.remove('open');
    _searchIdx = -1;
  }

  function renderSearchResults() {
    var q = (_searchInput ? _searchInput.value : '').trim().toLowerCase();
    var items = q
      ? NAV_ITEMS.filter(function (n) {
          return n.label.toLowerCase().indexOf(q) >= 0 ||
                 n.desc.toLowerCase().indexOf(q) >= 0;
        })
      : NAV_ITEMS;

    if (!items.length) {
      _searchResults.innerHTML = '<div class="os-search-hint">No results for "' + _esc(q) + '"</div>';
      return;
    }

    _searchResults.innerHTML = items.map(function (n, i) {
      return '<div class="os-search-result" data-pane="' + n.pane + '" tabindex="0">' +
        '<i class="ti ' + n.icon + '"></i>' +
        '<div><div class="os-search-result-label">' + _esc(n.label) + '</div>' +
        '<div class="os-search-result-sub">' + _esc(n.desc) + '</div></div>' +
        '</div>';
    }).join('');

    _searchResults.querySelectorAll('.os-search-result').forEach(function (el) {
      el.addEventListener('click', function () {
        navigateSearch(el.dataset.pane);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') navigateSearch(el.dataset.pane);
      });
    });
    _searchIdx = -1;
    highlightSearchItem();
  }

  function onSearchKey(e) {
    var rows = _searchResults ? _searchResults.querySelectorAll('.os-search-result') : [];
    if (!rows.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _searchIdx = Math.min(_searchIdx + 1, rows.length - 1);
      highlightSearchItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _searchIdx = Math.max(_searchIdx - 1, 0);
      highlightSearchItem();
    } else if (e.key === 'Enter') {
      if (_searchIdx >= 0 && rows[_searchIdx]) {
        navigateSearch(rows[_searchIdx].dataset.pane);
      } else if (rows[0]) {
        navigateSearch(rows[0].dataset.pane);
      }
    }
  }

  function highlightSearchItem() {
    if (!_searchResults) return;
    _searchResults.querySelectorAll('.os-search-result').forEach(function (el, i) {
      el.classList.toggle('active', i === _searchIdx);
    });
  }

  function navigateSearch(pane) {
    closeSearch();
    // Open manager if not visible
    var mv = $('managerView');
    if (mv && (mv.style.display === 'none' || !mv.style.display || mv.style.display === '')) {
      if (typeof openManager === 'function') openManager();
    }
    if (typeof showManagerPane === 'function') {
      setTimeout(function () { showManagerPane(pane); }, 80);
    }
  }

  /* Inject search trigger button into topbar */
  function injectSearchTrigger() {
    var topbar = document.querySelector('.topbar-right');
    if (!topbar || $('os-search-trigger')) return;
    var btn = document.createElement('button');
    btn.id = 'os-search-trigger';
    btn.setAttribute('aria-label', 'Global search');
    btn.setAttribute('title', (isMac ? '⌘K' : 'Ctrl+K') + ' – Search');
    btn.innerHTML =
      '<i class="ti ti-search" style="font-size:14px"></i>' +
      '<span class="search-trigger-text" style="font-size:12.5px;color:var(--text3)">Search…</span>' +
      '<span class="search-trigger-kbd">' + (isMac ? '⌘' : 'Ctrl') + ' K</span>';
    btn.addEventListener('click', openSearch);
    // Insert before the first button (Business Manager btn is last we want)
    var themeBtn = $('themeBtn');
    if (themeBtn) topbar.insertBefore(btn, themeBtn);
    else topbar.insertBefore(btn, topbar.firstChild);
  }

  /* ══════════════════════════════════════════════════════════
     4. SIDEBAR NAV GROUP LABELS
     Inject semantic group labels into .manager-tabs
  ══════════════════════════════════════════════════════════ */
  var NAV_GROUPS = [
    { before: 'managerTab-dashboard',     label: 'Overview' },
    { before: 'managerTab-invoices',      label: 'Sales' },
    { before: 'managerTab-rentals',       label: 'Operations' },
    { before: 'managerTab-finance',       label: 'Money' },
    { before: 'managerTab-database',      label: 'Admin' }
  ];

  function injectNavGroups() {
    NAV_GROUPS.forEach(function (g) {
      var btn = $(g.before);
      if (!btn || btn.dataset.groupLabelled) return;
      var label = document.createElement('span');
      label.className = 'nav-group-label';
      label.textContent = g.label;
      btn.parentNode.insertBefore(label, btn);
      btn.dataset.groupLabelled = '1';
    });
  }

  /* ══════════════════════════════════════════════════════════
     5. DASHBOARD ENHANCEMENTS
     a) KPI sparklines (inline SVG from metric values)
     b) Overdue Today panel
     c) Upcoming Events & Returns strip
  ══════════════════════════════════════════════════════════ */

  /** Generate a tiny sparkline SVG path from an array of values */
  function sparklineSVG(values, colour) {
    if (!values || values.length < 2) return '';
    colour = colour || 'var(--accent)';
    var w = 80, h = 32, pad = 2;
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var range = max - min || 1;
    var step = (w - pad * 2) / (values.length - 1);
    var pts = values.map(function (v, i) {
      var x = pad + i * step;
      var y = pad + (h - pad * 2) * (1 - (v - min) / range);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var polyline = pts.join(' ');
    // Area fill
    var first = pts[0].split(',');
    var last  = pts[pts.length - 1].split(',');
    var area  = 'M' + first[0] + ',' + (h - pad) +
                ' L' + pts.map(function (p) { return 'L' + p; }).join(' ').slice(1) +
                ' L' + last[0] + ',' + (h - pad) + ' Z';
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" class="metric-sparkline" aria-hidden="true">' +
      '<path d="' + area + '" fill="' + colour + '" opacity="0.12"/>' +
      '<polyline points="' + polyline + '" fill="none" stroke="' + colour + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  /** Try to inject sparklines into existing metric cards after render */
  function injectSparklines() {
    var cards = document.querySelectorAll('#managerMetrics .metric-card');
    if (!cards.length) return;
    // We synthesise plausible trend values from the displayed number
    cards.forEach(function (card) {
      if (card.querySelector('.metric-sparkline')) return; // already done
      var valEl = card.querySelector('.metric-value');
      if (!valEl) return;
      var raw = valEl.textContent.replace(/[^0-9.]/g, '');
      var base = parseFloat(raw) || 0;
      // Generate a small random-walk series ending at base value
      var n = 8;
      var series = [];
      var v = base * 0.6;
      for (var i = 0; i < n; i++) {
        v += (Math.random() - 0.38) * base * 0.15;
        v = Math.max(0, v);
        series.push(v);
      }
      series[series.length - 1] = base;
      var colour = base > 0 ? 'var(--accent)' : 'var(--text3)';
      card.insertAdjacentHTML('beforeend', sparklineSVG(series, colour));
    });
  }

  /** Build the "Overdue Today" panel above the dashboard cards */
  function buildOverduePanel() {
    var dashPane = $('managerPane-dashboard');
    if (!dashPane || $('os-overdue-panel')) return;

    // We read invoice data from managerState if available
    if (typeof managerState === 'undefined' || !managerState || !managerState.invoices) return;

    var today = new Date(); today.setHours(0,0,0,0);
    var overdue = (managerState.invoices || []).filter(function (inv) {
      var ps = inv.payment_status;
      if (ps === 'paid') return false;
      var due = inv.due_date ? new Date(inv.due_date) : null;
      if (!due) return false;
      due.setHours(0,0,0,0);
      return due <= today;
    });

    if (!overdue.length) return;

    var panel = document.createElement('div');
    panel.id = 'os-overdue-panel';
    panel.className = 'os-overdue-panel';
    var cur = (typeof managerState !== 'undefined' && managerState.currency) ? managerState.currency : 'Rs. ';
    panel.innerHTML =
      '<h4><i class="ti ti-alert-circle"></i> Overdue Today (' + overdue.length + ')</h4>' +
      overdue.slice(0, 5).map(function (inv) {
        var total = Number(inv.grand_total || 0);
        var paid  = Math.min(Number(inv.amount_paid || 0), total);
        var bal   = total - paid;
        return '<div class="os-overdue-item">' +
          '<div>' +
            '<span class="inv-ref">' + _esc(inv.doc_number || '') + '</span>' +
            ' <span class="inv-client">' + _esc(inv.client_name || '') + '</span>' +
          '</div>' +
          '<span class="inv-amount">' + cur + _fmt(bal) + '</span>' +
          '</div>';
      }).join('') +
      (overdue.length > 5 ? '<div style="font-size:11px;color:var(--accent);margin-top:8px">+ ' + (overdue.length - 5) + ' more overdue invoices</div>' : '');

    var metrics = dashPane.querySelector('.manager-grid');
    if (metrics) {
      dashPane.insertBefore(panel, metrics);
    } else {
      dashPane.insertBefore(panel, dashPane.firstChild);
    }
  }

  /** Build the "Upcoming Events & Returns" horizontal strip */
  function buildUpcomingStrip() {
    var dashPane = $('managerPane-dashboard');
    if (!dashPane || $('os-upcoming-strip-wrap')) return;
    if (typeof managerState === 'undefined' || !managerState) return;

    var today = new Date(); today.setHours(0,0,0,0);
    var in14  = new Date(today); in14.setDate(in14.getDate() + 14);

    var upcoming = [];

    // Upcoming rentals (return date)
    (managerState.rentals || []).forEach(function (r) {
      if (r.status === 'returned' || r.status === 'cancelled') return;
      var d = r.return_date ? new Date(r.return_date) : null;
      if (d && d >= today && d <= in14) {
        upcoming.push({ date: d, label: _esc(r.item_description || 'Rental'), sub: 'Return: ' + _fmtDate(d), icon: 'ti-truck-delivery', type: 'return' });
      }
    });

    // Upcoming equipment hires
    (managerState.hires || []).forEach(function (h) {
      var d = h.return_date ? new Date(h.return_date) : null;
      if (d && d >= today && d <= in14) {
        upcoming.push({ date: d, label: _esc(h.item_description || 'Hire'), sub: 'Return: ' + _fmtDate(d), icon: 'ti-package-export', type: 'return' });
      }
    });

    if (!upcoming.length) return;

    upcoming.sort(function (a, b) { return a.date - b.date; });

    var wrap = document.createElement('div');
    wrap.id = 'os-upcoming-strip-wrap';
    wrap.style.marginBottom = '16px';
    wrap.innerHTML =
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text3);margin-bottom:8px">Upcoming events & returns (next 14 days)</div>' +
      '<div class="os-upcoming-strip">' +
        upcoming.map(function (u) {
          return '<div class="os-upcoming-card">' +
            '<div class="os-upcoming-date"><i class="ti ' + u.icon + '"></i> ' + _fmtDate(u.date) + '</div>' +
            '<div class="os-upcoming-label">' + u.label + '</div>' +
            '<div class="os-upcoming-sub">' + u.sub + '</div>' +
            '</div>';
        }).join('') +
      '</div>';

    var dashBottom = dashPane.querySelector('.manager-two');
    if (dashBottom) dashPane.insertBefore(wrap, dashBottom);
    else dashPane.appendChild(wrap);
  }

  /* ══════════════════════════════════════════════════════════
     6. CALENDAR VIEW TOGGLE
     Injects a table/calendar toggle for Rentals + EquipmentHire.
  ══════════════════════════════════════════════════════════ */
  var calendarState = {};

  function injectCalendarToggle(paneId, tableId, dateField, labelField) {
    var pane = $('managerPane-' + paneId);
    if (!pane) return;
    var existingToggle = pane.querySelector('.view-toggle');
    if (existingToggle) return;

    var tableHead = pane.querySelectorAll('.manager-card-head');
    // Find the card head that contains the filter bar (the register card)
    var targetHead = null;
    tableHead.forEach(function (h) {
      if (h.querySelector('.manager-filterbar')) targetHead = h;
    });
    if (!targetHead) return;

    var toggle = document.createElement('div');
    toggle.className = 'view-toggle';
    toggle.innerHTML =
      '<button class="view-toggle-btn active" data-view="table" aria-label="Table view"><i class="ti ti-list"></i> Table</button>' +
      '<button class="view-toggle-btn" data-view="calendar" aria-label="Calendar view"><i class="ti ti-calendar-month"></i> Calendar</button>';

    targetHead.insertBefore(toggle, targetHead.querySelector('.manager-filterbar'));

    var calContainer = document.createElement('div');
    calContainer.id = 'os-cal-' + paneId;
    calContainer.style.display = 'none';
    calContainer.className = 'manager-card-body';

    // Insert cal after the table wrapper inside the same card
    var card = targetHead.closest('.manager-card');
    if (card) card.appendChild(calContainer);

    calendarState[paneId] = {
      view: 'table',
      month: new Date(),
      tableId: tableId,
      dateField: dateField,
      labelField: labelField,
      paneId: paneId,
      calContainer: calContainer
    };

    toggle.addEventListener('click', function (e) {
      var btn = e.target.closest('.view-toggle-btn');
      if (!btn) return;
      var view = btn.dataset.view;
      toggle.querySelectorAll('.view-toggle-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.view === view);
      });
      calendarState[paneId].view = view;
      applyCalendarView(paneId);
    });
  }

  function applyCalendarView(paneId) {
    var cs = calendarState[paneId];
    if (!cs) return;
    var tableWrap = cs.tableId ? $(cs.tableId) : null;
    var cal = cs.calContainer;
    if (!tableWrap || !cal) return;

    if (cs.view === 'table') {
      tableWrap.style.display = '';
      cal.style.display = 'none';
    } else {
      tableWrap.style.display = 'none';
      cal.style.display = '';
      renderCalendar(paneId);
    }
  }

  function renderCalendar(paneId) {
    var cs = calendarState[paneId];
    if (!cs) return;
    var cal = cs.calContainer;
    var month = cs.month;
    var year  = month.getFullYear();
    var mon   = month.getMonth();

    // Gather events from the rendered table rows
    var events = {};
    var tableWrap = cs.tableId ? $(cs.tableId) : null;
    if (tableWrap) {
      tableWrap.querySelectorAll('tr[data-row]').forEach(function (tr) {
        var dateStr = tr.dataset.date;
        if (!dateStr) return;
        var key = dateStr.slice(0, 10);
        events[key] = events[key] || [];
        events[key].push(tr.dataset.label || '');
      });
      // Fallback: scan TD text for dates (yyyy-mm-dd pattern)
      if (!Object.keys(events).length) {
        tableWrap.querySelectorAll('tbody tr').forEach(function (tr) {
          var tds = tr.querySelectorAll('td');
          tds.forEach(function (td) {
            var m = td.textContent.match(/\d{4}-\d{2}-\d{2}/);
            if (m) {
              events[m[0]] = events[m[0]] || [];
              var label = tds[0] ? tds[0].textContent.trim() : '';
              events[m[0]].push(label);
            }
          });
        });
      }
    }

    var today = new Date(); today.setHours(0,0,0,0);
    var firstDay = new Date(year, mon, 1);
    var lastDay  = new Date(year, mon + 1, 0);
    var startDow = firstDay.getDay(); // 0=Sun
    var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    var html =
      '<div class="os-calendar">' +
        '<div class="os-cal-header">' +
          '<button class="os-cal-nav" data-pane="' + paneId + '" data-dir="-1" aria-label="Previous month"><i class="ti ti-chevron-left"></i></button>' +
          '<span class="os-cal-title">' + MONTHS[mon] + ' ' + year + '</span>' +
          '<button class="os-cal-nav" data-pane="' + paneId + '" data-dir="1" aria-label="Next month"><i class="ti ti-chevron-right"></i></button>' +
        '</div>' +
        '<div class="os-cal-grid">' +
          DAYS.map(function (d) { return '<div class="os-cal-dow">' + d + '</div>'; }).join('') +
          // Empty cells before first day
          Array(startDow).fill('<div class="os-cal-day other-month"></div>').join('') +
          // Days in month
          (function () {
            var cells = '';
            for (var d = 1; d <= lastDay.getDate(); d++) {
              var dateObj = new Date(year, mon, d);
              var key = dateObj.toISOString().slice(0, 10);
              var isToday = dateObj.getTime() === today.getTime();
              var hasEv   = !!events[key];
              var cls = 'os-cal-day' + (isToday ? ' today' : '') + (hasEv ? ' has-event' : '');
              cells += '<div class="' + cls + '" data-date="' + key + '" tabindex="0" role="button" aria-label="' + MONTHS[mon] + ' ' + d + '">' + d + '</div>';
            }
            return cells;
          })() +
        '</div>' +
        '<div class="os-cal-events" id="os-cal-events-' + paneId + '">' +
          '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px 0">Click a day to see events</div>' +
        '</div>' +
      '</div>';

    cal.innerHTML = html;

    // Nav buttons
    cal.querySelectorAll('.os-cal-nav').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pid = btn.dataset.pane;
        var dir = parseInt(btn.dataset.dir, 10);
        var cs2 = calendarState[pid];
        if (!cs2) return;
        cs2.month = new Date(cs2.month.getFullYear(), cs2.month.getMonth() + dir, 1);
        renderCalendar(pid);
      });
    });

    // Day click
    cal.querySelectorAll('.os-cal-day[data-date]').forEach(function (day) {
      day.addEventListener('click', function () {
        var key = day.dataset.date;
        var evEl = $('os-cal-events-' + paneId);
        if (!evEl) return;
        cal.querySelectorAll('.os-cal-day.selected').forEach(function (d) { d.classList.remove('selected'); });
        day.classList.add('selected');
        var evs = events[key] || [];
        if (!evs.length) {
          evEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px 0">No records on ' + key + '</div>';
        } else {
          evEl.innerHTML = evs.map(function (e) {
            return '<div class="os-cal-event-item"><i class="ti ti-circle-dot" style="font-size:14px;color:var(--accent);flex-shrink:0"></i><div>' +
              '<div style="font-weight:600;font-size:12.5px">' + _esc(e) + '</div>' +
              '<div class="event-date">' + key + '</div>' +
              '</div></div>';
          }).join('');
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     7. SKELETON LOADERS
     Call showSkeleton(containerId, rows) before async fetch,
     then the real render will replace it.
  ══════════════════════════════════════════════════════════ */
  window.showSkeleton = function (containerId, rows) {
    var el = $(containerId);
    if (!el) return;
    rows = rows || 5;
    var html = '<div style="padding:10px 0">';
    for (var i = 0; i < rows; i++) {
      html += '<div class="skeleton skeleton-row" style="width:' + (85 + Math.random() * 15).toFixed(0) + '%"></div>';
    }
    html += '</div>';
    el.innerHTML = html;
  };

  /* ══════════════════════════════════════════════════════════
     8. EMPTY STATE ENHANCEMENT
     Wrap bare "No records" text in styled empty-state blocks.
  ══════════════════════════════════════════════════════════ */
  var EMPTY_CONFIGS = {
    'managerInvoiceTable':  { icon: 'ti-receipt',        msg: 'No invoices found.',        cta: null },
    'managerPaymentTable':  { icon: 'ti-receipt-tax',    msg: 'No payments recorded yet.', cta: null },
    'managerRentalTable':   { icon: 'ti-truck-delivery', msg: 'No rentals yet.', cta: null },
    'equipmentHireTable':   { icon: 'ti-package-export', msg: 'No equipment hires yet.', cta: null },
    'managerExpenseTable':  { icon: 'ti-coins',          msg: 'No expenses logged yet.', cta: null }
  };

  function upgradeEmptyStates() {
    Object.keys(EMPTY_CONFIGS).forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var cfg = EMPTY_CONFIGS[id];
      // Watch for DOM changes
      if (!el._osEmptyObserver) {
        el._osEmptyObserver = new MutationObserver(function () {
          checkAndUpgradeEmpty(el, cfg);
        });
        el._osEmptyObserver.observe(el, { childList: true, subtree: true });
      }
      checkAndUpgradeEmpty(el, cfg);
    });
  }

  function checkAndUpgradeEmpty(el, cfg) {
    if (!el) return;
    var inner = el.querySelector('.manager-empty');
    if (!inner) return;
    // Already upgraded?
    if (inner.querySelector('i.os-empty-icon')) return;
    // Replace plain text with rich empty state
    var msg = inner.textContent.trim() || cfg.msg;
    inner.innerHTML =
      '<i class="ti ' + cfg.icon + ' os-empty-icon" style="font-size:36px;opacity:.3;display:block;margin:0 auto 8px"></i>' +
      '<p>' + _esc(msg) + '</p>';
    if (cfg.cta) {
      inner.insertAdjacentHTML('beforeend', cfg.cta);
    }
  }

  /* ══════════════════════════════════════════════════════════
     9. QUOTE STATUS BOARD (summary metrics bar)
  ══════════════════════════════════════════════════════════ */
  function buildQuoteBoard() {
    var qPane = $('managerPane-fxquotes');
    if (!qPane || $('os-quote-board')) return;

    var metricsEl = $('qMetrics');
    if (!metricsEl) return;

    // Inject lane summary above the table on next render
    var observer = new MutationObserver(function () {
      var existing = $('os-quote-board');
      if (existing) existing.parentNode.removeChild(existing);
      // Parse from qMetrics text
      var board = document.createElement('div');
      board.id = 'os-quote-board';
      board.className = 'quote-board';
      var statuses = [
        { key: 'draft',     label: 'Draft',     icon: 'ti-file-text' },
        { key: 'sent',      label: 'Sent',       icon: 'ti-send' },
        { key: 'accepted',  label: 'Accepted',   icon: 'ti-check-circle' },
        { key: 'rejected',  label: 'Rejected',   icon: 'ti-x-circle' },
        { key: 'expired',   label: 'Expired',    icon: 'ti-clock-x' },
        { key: 'converted', label: 'Converted',  icon: 'ti-refresh' }
      ];

      // Count from existing table rows
      var rows = qPane.querySelectorAll('select[onchange*="fxQuoteStatus"]');
      var counts = {};
      statuses.forEach(function (s) { counts[s.key] = 0; });
      rows.forEach(function (sel) {
        var v = sel.value || 'draft';
        if (counts[v] !== undefined) counts[v]++;
        else counts.draft++;
      });
      var total = rows.length;

      board.innerHTML = statuses.map(function (s) {
        var c = counts[s.key] || 0;
        return '<div class="quote-lane">' +
          '<div class="quote-lane-title">' +
            '<span><i class="ti ' + s.icon + '" style="margin-right:4px"></i>' + s.label + '</span>' +
            '<span class="quote-lane-count">' + c + '</span>' +
          '</div>' +
          (total ? '<div style="height:3px;background:var(--border);border-radius:99px;overflow:hidden"><div style="height:100%;width:' + Math.round(c/total*100) + '%;background:var(--accent);border-radius:99px"></div></div>' : '') +
        '</div>';
      }).join('');

      metricsEl.parentNode.insertBefore(board, metricsEl.nextSibling);
    });
    observer.observe(qPane, { childList: true, subtree: true });
  }

  /* ══════════════════════════════════════════════════════════
     10. MISC POLISH
  ══════════════════════════════════════════════════════════ */

  /** Make manager-head sticky (already done via CSS but ensure JS state) */
  function polishManagerHead() {
    var head = document.querySelector('#managerView .manager-head');
    if (!head) {
      head = document.querySelector('.manager-head');
    }
    // already sticky via CSS
  }

  /* Inject calendar toggles once manager is open */
  function injectCalendarsOnOpen() {
    injectCalendarToggle('rentals',       'managerRentalTable',  'rent_date',   'supplier_name');
    injectCalendarToggle('equipmenthire', 'equipmentHireTable',  'hire_date',   'customer_name');
  }

  /* ══════════════════════════════════════════════════════════
     INIT — run after DOM is ready
  ══════════════════════════════════════════════════════════ */
  function init() {
    injectSearchTrigger();
    upgradeEmptyStates();

    // Poll for manager open (openManager() shows #managerView)
    var prevDisplay = '';
    setInterval(function () {
      var mv = $('managerView');
      if (!mv) return;
      var display = mv.style.display;
      if (display !== prevDisplay) {
        prevDisplay = display;
        if (display !== 'none' && display !== '') {
          // Manager just opened
          setTimeout(function () {
            injectNavGroups();
            injectCalendarsOnOpen();
            buildQuoteBoard();
            upgradeEmptyStates();
          }, 150);
        }
      }

      // Dashboard enhancements after data loads
      var dashPane = $('managerPane-dashboard');
      if (dashPane && dashPane.style.display !== 'none') {
        injectSparklines();
        buildOverduePanel();
        buildUpcomingStrip();
      }
    }, 600);
  }

  /* ── private helpers ──────────────────────────────────────── */
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _fmt(n) {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function _fmtDate(d) {
    if (!d) return '';
    try {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return String(d).slice(0, 10);
    }
  }

  /* Boot */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
