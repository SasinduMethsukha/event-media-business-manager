/* Event Media OS v7 — new features.
 *
 *   1. Advance payment line on documents (e.g. "50% advance to confirm").
 *   2. Amount in words under the grand total ("Rupees Seven Hundred ... Only").
 *   3. Item library - every saved document teaches it your line items and
 *      prices; descriptions autocomplete and can be inserted from a picker.
 *   4. Command palette (Ctrl+K) - jump to any saved document or action.
 *   5. Duplicate as new - reuse a document with a fresh number and dates.
 *   6. Share on WhatsApp - send the document summary to a client.
 *   7. "Needs attention" strip on the Business Manager dashboard.
 *   8. Keyboard shortcut help (press ?).
 *
 * Loaded after v6-enhancements.js. Wraps existing globals only.
 */
(function () {
  'use strict';

  function has(fn) { return typeof window[fn] === 'function'; }
  function $(id) { return document.getElementById(id); }
  function escH(v) { return has('esc') ? window.esc(v) : String(v == null ? '' : v); }
  function money(n) { return has('fmt') ? window.fmt(n) : String(n); }
  function toast(m, t) { if (has('showToast')) window.showToast(m, t); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ─────────────────────────────────────────────────────────────
  // 1 + 2. DOCUMENT OPTIONS: advance payment, amount in words
  // ─────────────────────────────────────────────────────────────
  var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function under1000(n) {
    var out = [];
    if (n >= 100) { out.push(ONES[Math.floor(n / 100)] + ' Hundred'); n %= 100; }
    if (n >= 20) { out.push(TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '')); }
    else if (n > 0) out.push(ONES[n]);
    return out.join(' ');
  }
  function intToWords(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'Zero';
    var scales = ['', ' Thousand', ' Million', ' Billion', ' Trillion'], parts = [], i = 0;
    while (n > 0 && i < scales.length) {
      var chunk = n % 1000;
      if (chunk) parts.unshift(under1000(chunk) + scales[i]);
      n = Math.floor(n / 1000); i++;
    }
    return parts.join(' ');
  }
  var CURRENCY_WORDS = {
    'Rs.': ['Rupees', 'Cents'], '$': ['US Dollars', 'Cents'], 'EUR': ['Euros', 'Cents'],
    'GBP': ['Pounds', 'Pence'], 'INR': ['Indian Rupees', 'Paise'], 'AED': ['Dirhams', 'Fils'], 'AUD': ['Australian Dollars', 'Cents']
  };
  function amountInWords(amount, currencySymbol) {
    var cw = CURRENCY_WORDS[String(currencySymbol || 'Rs.').trim()] || ['', 'Cents'];
    var rounded = Math.round(Math.abs(Number(amount) || 0) * 100);
    var whole = Math.floor(rounded / 100), cents = rounded % 100;
    var s = (cw[0] ? cw[0] + ' ' : '') + intToWords(whole);
    if (cents) s += ' and ' + cw[1] + ' ' + intToWords(cents);
    return s + ' Only';
  }
  window.amountInWords = amountInWords;

  function checked(id) { var e = $(id); return !!(e && e.checked); }
  function val(id) { var e = $(id); return e ? e.value : ''; }

  function advanceAmount(grand) {
    if (!checked('advEnabled')) return 0;
    var v = parseFloat(val('advVal')) || 0;
    var amt = val('advMode') === 'amt' ? v : grand * v / 100;
    return Math.max(0, Math.min(grand, amt));
  }

  window.docSummaryExtras = function (t) {
    var html = '';
    var adv = advanceAmount(t.grand);
    if (checked('advEnabled') && adv > 0) {
      var label = escH(val('advLabel') || 'Advance payable') + (val('advMode') === 'amt' ? '' : ' (' + escH(parseFloat(val('advVal')) || 0) + '%)');
      html += '<div class="sum-line v7-adv-line"><span>' + label + '</span><span>' + money(adv) + '</span></div>';
      if (checked('advShowBalance')) html += '<div class="sum-line v7-adv-balance"><span>Balance due</span><span>' + money(t.grand - adv) + '</span></div>';
    }
    if (checked('wordsEnabled') && t.grand > 0) {
      html += '<div class="v7-words">' + escH(amountInWords(t.grand, val('currency'))) + '</div>';
    }
    return html;
  };

  // Older saved documents do not contain these fields; reset them so a loaded
  // document never inherits the previous document's settings.
  var OPTION_DEFAULTS = { advEnabled: false, advLabel: 'Advance to confirm', advMode: 'pct', advVal: '50', advShowBalance: true, wordsEnabled: false };
  function applyOptionDefaults(form) {
    Object.keys(OPTION_DEFAULTS).forEach(function (id) {
      if (form && Object.prototype.hasOwnProperty.call(form, id)) return;
      var el = $(id); if (!el) return;
      if (el.type === 'checkbox') el.checked = !!OPTION_DEFAULTS[id]; else el.value = OPTION_DEFAULTS[id];
    });
  }
  if (has('applyDocSnapshot')) {
    var origApply = window.applyDocSnapshot;
    window.applyDocSnapshot = function (state) {
      window.__v7Loads = (window.__v7Loads || 0) + 1;
      applyOptionDefaults(state && state.form);
      var r = origApply.apply(this, arguments);
      if (has('toggleField') && $('advFields')) window.toggleField('advFields', checked('advEnabled'));
      return r;
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ITEM LIBRARY
  // Stored under an "invoicegen:" key so Export Backup includes it.
  // ─────────────────────────────────────────────────────────────
  var LIB_KEY = 'invoicegen:itemLibrary';
  function libLoad() { var l = lsGet(LIB_KEY, []); return Array.isArray(l) ? l : []; }
  function libSave(list) { lsSet(LIB_KEY, list.slice(0, 1000)); refreshDatalist(); }
  function norm(s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function learnFrom(cats) {
    var lib = libLoad(), idx = {};
    lib.forEach(function (x, i) { idx[norm(x.desc)] = i; });
    var now = new Date().toISOString(), added = 0;
    (cats || []).forEach(function (c) {
      if (c.type === 'removed') return;
      (c.items || []).forEach(function (it) {
        var d = String(it.desc || '').trim();
        var unit = parseFloat(it.unit) || 0;
        if (!d || d.length < 2 || !(unit > 0)) return;
        var k = norm(d);
        if (k in idx) {
          var e = lib[idx[k]];
          e.unit = unit; e.tag = it.tag || e.tag; e.category = c.name || e.category; e.uses = (e.uses || 0) + 1; e.updated = now;
        } else {
          idx[k] = lib.push({ desc: d, tag: it.tag || 'General', unit: unit, category: c.name || '', uses: 1, updated: now }) - 1;
          added++;
        }
      });
    });
    libSave(lib);
    return added;
  }
  window.itemLibrary = { list: libLoad, learnFrom: learnFrom };

  function refreshDatalist() {
    var dl = $('v7ItemLibraryList');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'v7ItemLibraryList'; document.body.appendChild(dl); }
    dl.innerHTML = libLoad()
      .sort(function (a, b) { return (b.uses || 0) - (a.uses || 0); })
      .map(function (x) { return '<option value="' + escH(x.desc) + '">' + escH((x.tag || '') + ' · ' + money(x.unit)) + '</option>'; })
      .join('');
  }

  function decorateItemInputs() {
    document.querySelectorAll('#categories tr.item-row .item-cell-desc input').forEach(function (inp) {
      if (!inp.hasAttribute('list')) inp.setAttribute('list', 'v7ItemLibraryList');
    });
    var bar = document.querySelector('#categories .cat-add-actions');
    if (bar && !bar.querySelector('.v7-lib-btn')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sm btn-ghost v7-lib-btn';
      b.innerHTML = '<i class="ti ti-books"></i> From item library';
      b.onclick = function () { openLibrary(); };
      bar.appendChild(b);
    }
  }
  if (has('renderCats')) {
    var origRenderCats = window.renderCats;
    window.renderCats = function () { var r = origRenderCats.apply(this, arguments); decorateItemInputs(); return r; };
  }

  // Picking a known description fills in its tag and price (only if the line
  // has no price yet, so typed prices are never overwritten).
  document.addEventListener('change', function (e) {
    var inp = e.target;
    if (!inp || !inp.matches || !inp.matches('#categories tr.item-row .item-cell-desc input')) return;
    var row = inp.closest('tr.item-row');
    var entry = libLoad().filter(function (x) { return norm(x.desc) === norm(inp.value); })[0];
    if (!row || !entry || !Array.isArray(window.cats)) return;
    var cId = row.getAttribute('data-cid'), idx = Number(row.getAttribute('data-idx'));
    var c = window.cats.filter(function (x) { return String(x.id) === String(cId); })[0];
    var it = c && c.items[idx];
    if (!it || (parseFloat(it.unit) || 0) > 0) return;
    it.desc = entry.desc; it.tag = entry.tag || it.tag; it.unit = entry.unit;
    window.renderCats(); window.render();
    toast('Filled in from your item library: ' + money(entry.unit), 'success');
  });

  // Learn from every successful save.
  if (has('markDocClean')) {
    var origClean = window.markDocClean;
    window.markDocClean = function () {
      var r = origClean.apply(this, arguments);
      if (window.__v7Saving) { window.__v7Saving = false; try { learnFrom(window.cats); } catch (e) {} }
      return r;
    };
  }
  if (has('saveCurrentDoc')) {
    var origSave = window.saveCurrentDoc;
    window.saveCurrentDoc = function () {
      window.__v7Saving = true;
      var p = origSave.apply(this, arguments);
      Promise.resolve(p).then(function () { window.__v7Saving = false; }, function () { window.__v7Saving = false; });
      return p;
    };
  }

  function targetCategory() {
    var cats = window.cats || [];
    for (var i = cats.length - 1; i >= 0; i--) if ((cats[i].type || 'standard') === 'standard') return cats[i];
    return cats[cats.length - 1];
  }
  function insertFromLibrary(entry, catId) {
    var cats = window.cats || [];
    var c = cats.filter(function (x) { return String(x.id) === String(catId); })[0] || targetCategory();
    if (!c) { window.addCategory({ name: entry.category || 'Services', items: [[entry.desc, entry.tag, 1, entry.unit]] }); return; }
    // Replace the empty placeholder line a new category starts with.
    if (c.items.length === 1 && !String(c.items[0].desc || '').trim() && !(parseFloat(c.items[0].unit) > 0)) c.items = [];
    c.items.push({ desc: entry.desc, tag: entry.tag || 'General', qty: 1, unit: entry.unit, days: 1, multiDay: false,
      showDesc: true, showTag: true, showQty: true, showUnit: true, showTotal: true, manualTotal: false, total: 0 });
    window.renderCats(); window.render();
    toast('Added "' + entry.desc + '" to ' + (c.name || 'the quotation'), 'success');
  }

  // ─────────────────────────────────────────────────────────────
  // Shared overlay (used by the library, palette and shortcuts)
  // ─────────────────────────────────────────────────────────────
  var lastFocus = null;
  function openOverlay(id, inner, onKey) {
    closeOverlay();
    lastFocus = document.activeElement;
    var ov = document.createElement('div');
    ov.className = 'v7-overlay';
    ov.id = id;
    ov.innerHTML = '<div class="v7-dialog" role="dialog" aria-modal="true">' + inner + '</div>';
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeOverlay(); });
    ov.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeOverlay(); return; }
      if (onKey) onKey(e);
    });
    document.body.appendChild(ov);
    return ov;
  }
  function closeOverlay() {
    var ov = document.querySelector('.v7-overlay');
    if (ov) ov.remove();
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }
  window.closeV7Overlay = closeOverlay;

  function openLibrary() {
    var cats = (window.cats || []).filter(function (c) { return c.type !== 'removed'; });
    var t = targetCategory();
    var opts = cats.map(function (c) { return '<option value="' + escH(c.id) + '"' + (t && c.id === t.id ? ' selected' : '') + '>' + escH(c.name || 'Category') + '</option>'; }).join('');
    var ov = openOverlay('v7Library',
      '<div class="v7-dialog-head"><h2>Item library</h2><button type="button" class="v7-x" aria-label="Close" data-close>&times;</button></div>' +
      '<p class="v7-dialog-sub">Items and prices from your saved documents. Click one to add it.</p>' +
      '<div class="v7-lib-controls"><input type="search" id="v7LibSearch" placeholder="Search items" autocomplete="off">' +
      (opts ? '<label>Add to <select id="v7LibCat">' + opts + '</select></label>' : '') + '</div>' +
      '<div class="v7-lib-list" id="v7LibList"></div>' +
      '<div class="v7-dialog-foot"><button type="button" class="btn btn-sm" id="v7LibLearn"><i class="ti ti-download"></i> Add items from the current document</button></div>');
    ov.querySelector('[data-close]').onclick = closeOverlay;
    function draw() {
      var q = norm(val('v7LibSearch'));
      var list = libLoad().filter(function (x) { return !q || norm(x.desc + ' ' + x.tag + ' ' + x.category).indexOf(q) >= 0; })
        .sort(function (a, b) { return (b.uses || 0) - (a.uses || 0) || String(a.desc).localeCompare(b.desc); });
      var box = $('v7LibList');
      if (!list.length) {
        box.innerHTML = '<div class="v7-empty">' + (q ? 'No items match "' + escH(val('v7LibSearch')) + '".' : 'Your library fills up automatically each time you save a document. You can also add the items in the current document now.') + '</div>';
        return;
      }
      box.innerHTML = list.slice(0, 200).map(function (x) {
        return '<div class="v7-lib-row"><button type="button" class="v7-lib-pick" data-desc="' + escH(x.desc) + '">' +
          '<span class="v7-lib-name">' + escH(x.desc) + '</span><span class="v7-lib-meta">' + escH(x.tag || '') + (x.category ? ' in ' + escH(x.category) : '') + '</span>' +
          '<span class="v7-lib-price">' + money(x.unit) + '</span></button>' +
          '<button type="button" class="v7-lib-del" aria-label="Remove ' + escH(x.desc) + ' from library" data-del="' + escH(x.desc) + '"><i class="ti ti-trash"></i></button></div>';
      }).join('');
    }
    ov.addEventListener('click', function (e) {
      var pick = e.target.closest('.v7-lib-pick'), del = e.target.closest('.v7-lib-del');
      if (pick) {
        var entry = libLoad().filter(function (x) { return x.desc === pick.getAttribute('data-desc'); })[0];
        if (entry) insertFromLibrary(entry, val('v7LibCat'));
      } else if (del) {
        var d = del.getAttribute('data-del');
        libSave(libLoad().filter(function (x) { return x.desc !== d; }));
        draw();
      }
    });
    $('v7LibSearch').addEventListener('input', draw);
    $('v7LibLearn').onclick = function () { var n = learnFrom(window.cats); draw(); toast(n ? 'Added ' + n + ' item(s) to the library' : 'Everything in this document is already in the library', 'success'); };
    draw();
    $('v7LibSearch').focus();
  }
  window.openItemLibrary = openLibrary;

  // ─────────────────────────────────────────────────────────────
  // 5. DUPLICATE AS NEW
  // ─────────────────────────────────────────────────────────────
  async function duplicateAsNew() {
    var issue = val('issueDate'), due = val('dueDate');
    var offset = 30;
    if (issue && due) { var d = (new Date(due) - new Date(issue)) / 864e5; if (isFinite(d) && d >= 0) offset = Math.round(d); }
    var today = has('localISODate') ? window.localISODate() : new Date().toISOString().slice(0, 10);
    $('issueDate').value = today;
    $('dueDate').value = has('addDaysISO') ? window.addDaysISO(today, offset) : today;
    window.docNumManual = false;
    if (has('regenerateDocNum')) await window.regenerateDocNum(); else window.render();
    toast('Copied as new ' + val('docType') + ' ' + val('docNum') + '. Save it when ready.', 'success');
  }
  window.duplicateAsNew = duplicateAsNew;
  window.duplicateSavedDoc = async function (id) {
    var before = window.__v7Loads || 0;
    await window.loadSavedDoc(id);
    // Only copy if the document actually loaded (not cancelled / failed).
    if ((window.__v7Loads || 0) > before) await duplicateAsNew();
  };
  if (has('renderHistoryCards')) {
    var origCards = window.renderHistoryCards;
    window.renderHistoryCards = function (rows) {
      var r = origCards.apply(this, arguments);
      document.querySelectorAll('#historyList .signer-card').forEach(function (card, i) {
        var row = rows && rows[i];
        var actions = card.querySelector('.btn-danger');
        if (!row || !actions || card.querySelector('.v7-dup')) return;
        var b = document.createElement('button');
        b.className = 'btn btn-sm btn-ghost v7-dup';
        b.title = 'Copy as a new document with a fresh number';
        b.innerHTML = '<i class="ti ti-copy"></i> Copy';
        b.onclick = function () { window.duplicateSavedDoc(row.id); };
        actions.parentNode.insertBefore(b, actions);
      });
      return r;
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 6. SHARE ON WHATSAPP
  // ─────────────────────────────────────────────────────────────
  function docSummaryText() {
    var t = has('calcTotals') ? window.calcTotals() : { grand: 0 };
    var type = val('docType') || 'Quotation';
    var client = String(val('clientContact') || val('clientName') || '').split('\n')[0].trim();
    var lines = [];
    lines.push('Dear ' + (client || 'Sir/Madam') + ',');
    lines.push('');
    lines.push('Please find our ' + type.toLowerCase() + ' details below.');
    lines.push(type + ' no: ' + val('docNum'));
    if (checked('showEvent') && val('eventName').trim()) lines.push('Event: ' + val('eventName').trim());
    var dates = has('getActiveEventDates') ? window.getActiveEventDates() : [];
    if (dates.length) lines.push('Date(s): ' + dates.join(', '));
    lines.push('Total: ' + money(t.grand));
    var adv = advanceAmount(t.grand);
    if (adv > 0) lines.push((val('advLabel') || 'Advance payable') + ': ' + money(adv));
    if (val('dueDate') && type !== 'Credit Note') lines.push((type === 'Quotation' ? 'Valid until: ' : 'Due by: ') + val('dueDate'));
    lines.push('');
    lines.push('The full PDF will be shared with this message. Thank you,');
    lines.push(val('coName') || 'Event Media Production');
    return lines.join('\n');
  }
  window.docSummaryText = docSummaryText;
  window.shareDocWhatsApp = function () {
    var text = docSummaryText();
    var ov = openOverlay('v7Share',
      '<div class="v7-dialog-head"><h2>Share on WhatsApp</h2><button type="button" class="v7-x" aria-label="Close" data-close>&times;</button></div>' +
      '<p class="v7-dialog-sub">Edit the message if needed, then open WhatsApp. Download the PDF first to attach it in the chat.</p>' +
      '<label class="v7-field">Client WhatsApp number <span>(optional, with country code e.g. 94771234567)</span><input id="v7ShareNum" inputmode="tel" autocomplete="off"></label>' +
      '<label class="v7-field">Message<textarea id="v7ShareText" rows="11"></textarea></label>' +
      '<div class="v7-dialog-foot"><button type="button" class="btn btn-sm" id="v7SharePdf"><i class="ti ti-file-type-pdf"></i> Download PDF</button>' +
      '<button type="button" class="btn btn-sm" id="v7ShareCopy"><i class="ti ti-copy"></i> Copy message</button>' +
      '<button type="button" class="btn btn-sm v7-primary" id="v7ShareGo"><i class="ti ti-brand-whatsapp"></i> Open WhatsApp</button></div>');
    $('v7ShareText').value = text;
    ov.querySelector('[data-close]').onclick = closeOverlay;
    $('v7SharePdf').onclick = function () { window.downloadPDF(); };
    $('v7ShareCopy').onclick = function () {
      var txt = $('v7ShareText').value;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('Message copied', 'success'); }, function () { $('v7ShareText').select(); toast('Press Ctrl+C to copy the selected message', 'info'); });
    };
    $('v7ShareGo').onclick = function () {
      var num = val('v7ShareNum').replace(/\D/g, '');
      window.open('https://wa.me/' + num + '?text=' + encodeURIComponent($('v7ShareText').value), '_blank', 'noopener');
    };
    $('v7ShareNum').focus();
  };

  // ─────────────────────────────────────────────────────────────
  // 4. COMMAND PALETTE
  // ─────────────────────────────────────────────────────────────
  function isAdmin() { return has('isProfileAdmin') ? window.isProfileAdmin() : true; }
  function inManager() { return document.body.classList.contains('manager-open') || document.body.classList.contains('employee-mode'); }
  function actions() {
    var a = [
      { icon: 'ti-device-floppy', label: 'Save document', hint: 'Ctrl S', run: function () { window.saveCurrentDoc(); }, editor: true },
      { icon: 'ti-file-type-pdf', label: 'Download PDF', run: function () { window.downloadPDF(); }, editor: true },
      { icon: 'ti-printer', label: 'Print document', run: function () { window.printDocument(); }, editor: true },
      { icon: 'ti-brand-whatsapp', label: 'Share on WhatsApp', run: function () { window.shareDocWhatsApp(); }, editor: true },
      { icon: 'ti-copy', label: 'Copy as new document', run: function () { duplicateAsNew(); }, editor: true },
      { icon: 'ti-git-branch', label: 'Create revision of this document', run: function () { window.createDocRevision(); }, editor: true },
      { icon: 'ti-books', label: 'Open item library', run: openLibrary, editor: true },
      { icon: 'ti-sparkles', label: 'AI quotation assistant', run: function () { window.openAiQuoteAssistant(); }, editor: true },
      { icon: 'ti-file-invoice', label: 'Switch to Invoice', run: function () { window.setDocType('Invoice'); }, editor: true },
      { icon: 'ti-file-description', label: 'Switch to Quotation', run: function () { window.setDocType('Quotation'); }, editor: true },
      { icon: 'ti-history', label: 'Saved documents', run: function () { if (inManager()) window.closeManager(); window.showPane('history'); }, editor: true },
      { icon: 'ti-layout-grid', label: 'Start from a template', run: function () { if (inManager()) window.closeManager(); window.showPane('templates'); }, editor: true },
      { icon: 'ti-layout-dashboard', label: 'Business Manager dashboard', run: function () { window.openManager(); window.showManagerPane('dashboard'); } },
      { icon: 'ti-receipt', label: 'Record payment received', run: function () { window.openManager(); window.showManagerPane('payments'); window.openPaymentReceiptModal(); } },
      { icon: 'ti-file-invoice', label: 'Invoice tracker', run: function () { window.openManager(); window.showManagerPane('invoices'); } },
      { icon: 'ti-truck-delivery', label: 'Supplier rentals', run: function () { window.openManager(); window.showManagerPane('rentals'); }, staff: true },
      { icon: 'ti-speakerphone', label: 'Equipment hire', run: function () { window.openManager(); window.showManagerPane('equipmenthire'); }, staff: true },
      { icon: 'ti-chart-line', label: 'Finance & expenses', run: function () { window.openManager(); window.showManagerPane('finance'); } },
      { icon: 'ti-clock-dollar', label: 'Receivables & reminders', run: function () { window.openManager(); window.showManagerPane('fxreceivables'); } },
      { icon: 'ti-address-book', label: 'Clients', run: function () { window.openManager(); window.showManagerPane('fxclients'); } },
      { icon: 'ti-moon', label: 'Switch light / dark', run: function () { window.toggleTheme(); }, staff: true },
      { icon: 'ti-keyboard', label: 'Keyboard shortcuts', hint: '?', run: openShortcuts, staff: true }
    ];
    if (!isAdmin()) a = a.filter(function (x) { return x.staff; });
    return a;
  }
  function docEntries() {
    if (!isAdmin()) return [];
    var rows = (typeof currentHistoryEntries !== 'undefined' && currentHistoryEntries) || [];
    return rows.map(function (r) {
      return { icon: /invoice/i.test(r.doc_type || '') ? 'ti-file-invoice' : 'ti-file-description', label: (r.doc_number || '(no number)') + '  ' + (r.client_name || ''),
        sub: [r.doc_type, r.event_name, (r.currency || 'Rs. ') + Number(r.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })].filter(Boolean).join(', '),
        run: function () { if (inManager() && has('closeManager')) window.closeManager(); window.loadSavedDoc(r.id); } };
    });
  }
  function score(item, q) {
    if (!q) return 1;
    var hay = norm(item.label + ' ' + (item.sub || ''));
    if (hay.indexOf(q) === 0) return 3;
    if (hay.indexOf(q) > 0) return 2;
    var words = q.split(' ');
    return words.every(function (w) { return hay.indexOf(w) >= 0; }) ? 1 : 0;
  }
  function openCommandPalette() {
    var gate = $('authGate');
    if (gate && gate.style.display !== 'none' && gate.style.display !== '') return;
    var sel = 0, results = [];
    var ov = openOverlay('v7Palette',
      '<div class="v7-pal-input"><i class="ti ti-search" aria-hidden="true"></i><input id="v7PalInput" placeholder="Search documents, clients or actions" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="v7PalList"></div>' +
      '<div class="v7-pal-list" id="v7PalList" role="listbox"></div>' +
      '<div class="v7-pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>',
      function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
        else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
      });
    ov.classList.add('v7-overlay-top');
    function choose(i) { var it = results[i]; if (!it) return; closeOverlay(); setTimeout(function () { try { it.run(); } catch (err) { console.error(err); } }, 0); }
    function compute() {
      var q = norm(val('v7PalInput'));
      var acts = actions().map(function (x) { return { it: x, s: score(x, q), g: 'Actions' }; }).filter(function (x) { return x.s; });
      var docs = docEntries().map(function (x) { return { it: x, s: score(x, q), g: 'Saved documents' }; }).filter(function (x) { return x.s; });
      acts.sort(function (a, b) { return b.s - a.s; }); docs.sort(function (a, b) { return b.s - a.s; });
      var list = q ? docs.slice(0, 8).concat(acts.slice(0, 8)) : acts.slice(0, 8).concat(docs.slice(0, 6));
      if (q && docs.length && acts.length && acts[0].s > docs[0].s) list = acts.slice(0, 8).concat(docs.slice(0, 8));
      results = list.map(function (x) { x.it._group = x.g; return x.it; });
      sel = 0; paint();
    }
    function paint() {
      var box = $('v7PalList'), html = '', group = '';
      if (!results.length) { box.innerHTML = '<div class="v7-empty">Nothing matches. Try a document number, client name or an action like "pdf".</div>'; return; }
      results.forEach(function (it, i) {
        if (it._group !== group) { group = it._group; html += '<div class="v7-pal-group">' + group + '</div>'; }
        html += '<div class="v7-pal-item' + (i === sel ? ' is-sel' : '') + '" role="option" aria-selected="' + (i === sel) + '" data-i="' + i + '">' +
          '<i class="ti ' + it.icon + '" aria-hidden="true"></i><span class="v7-pal-text"><span>' + escH(it.label) + '</span>' + (it.sub ? '<small>' + escH(it.sub) + '</small>' : '') + '</span>' +
          (it.hint ? '<kbd>' + escH(it.hint) + '</kbd>' : '') + '</div>';
      });
      box.innerHTML = html;
      var cur = box.querySelector('.is-sel'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    }
    $('v7PalList').addEventListener('mousemove', function (e) { var r = e.target.closest('.v7-pal-item'); if (r && Number(r.dataset.i) !== sel) { sel = Number(r.dataset.i); paint(); } });
    $('v7PalList').addEventListener('click', function (e) { var r = e.target.closest('.v7-pal-item'); if (r) choose(Number(r.dataset.i)); });
    $('v7PalInput').addEventListener('input', compute);
    compute();
    $('v7PalInput').focus();
    // Load saved documents in the background if they have not been fetched yet.
    if (isAdmin() && has('refreshHistoryList') && !(typeof currentHistoryEntries !== 'undefined' && currentHistoryEntries.length) && has('sbConfigured') && window.sbConfigured()) {
      Promise.resolve(window.refreshHistoryList()).then(function () { if ($('v7PalInput')) compute(); });
    }
  }
  window.openCommandPalette = openCommandPalette;

  // ─────────────────────────────────────────────────────────────
  // 8. SHORTCUTS
  // ─────────────────────────────────────────────────────────────
  function openShortcuts() {
    var rows = [['Ctrl K', 'Search documents and actions'], ['Ctrl S', 'Save the open document'], ['Ctrl P', 'Print the document'], ['Esc', 'Close a dialog or the phone preview'], ['?', 'Show this list']];
    var ov = openOverlay('v7Keys', '<div class="v7-dialog-head"><h2>Keyboard shortcuts</h2><button type="button" class="v7-x" aria-label="Close" data-close>&times;</button></div>' +
      '<dl class="v7-keys">' + rows.map(function (r) { return '<dt><kbd>' + r[0] + '</kbd></dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' +
      '<p class="v7-dialog-sub">On a Mac use Cmd instead of Ctrl.</p>');
    ov.querySelector('[data-close]').onclick = closeOverlay;
    ov.querySelector('[data-close]').focus();
  }
  window.openShortcuts = openShortcuts;

  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (document.getElementById('v7Palette')) closeOverlay(); else openCommandPalette();
      return;
    }
    var t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (e.key === '?' && !typing && !mod && !document.querySelector('.v7-overlay')) {
      var gate = $('authGate'); if (gate && gate.style.display === 'flex') return;
      e.preventDefault(); openShortcuts();
    }
  }, true);

  // ─────────────────────────────────────────────────────────────
  // 7. NEEDS ATTENTION (dashboard)
  // ─────────────────────────────────────────────────────────────
  function daysFromToday(iso) {
    if (!iso) return null;
    var p = String(iso).slice(0, 10).split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]), now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((d - today) / 864e5);
  }
  function renderAttention() {
    var pane = $('managerPane-dashboard');
    if (!pane || !window.managerState) return;
    var st = window.managerState, items = [];
    var inv = (st.invoices || []).filter(function (x) { return window.invoiceStatus(x) !== 'paid'; });
    var overdue = inv.filter(function (x) { var d = daysFromToday(x.due_date); return d !== null && d < 0; });
    var soon = inv.filter(function (x) { var d = daysFromToday(x.due_date); return d !== null && d >= 0 && d <= 7; });
    var bal = function (list) { return list.reduce(function (s, x) { return s + Math.max(0, Number(x.grand_total || 0) - window.invoicePaidAmount(x)); }, 0); };
    if (overdue.length) items.push({ tone: 'bad', pane: 'fxreceivables', count: overdue.length, text: overdue.length === 1 ? 'invoice overdue' : 'invoices overdue', amt: bal(overdue) });
    if (soon.length) items.push({ tone: 'warn', pane: 'invoices', count: soon.length, text: 'due in the next 7 days', amt: bal(soon) });
    var rentals = (st.rentals || []).filter(function (r) { var d = daysFromToday(r.return_date); return r.return_date && ['returned', 'paid', 'cancelled'].indexOf(r.status) < 0 && d !== null && d <= 3; });
    if (rentals.length) items.push({ tone: rentals.some(function (r) { return daysFromToday(r.return_date) < 0; }) ? 'bad' : 'warn', pane: 'rentals', count: rentals.length, text: 'supplier rental' + (rentals.length === 1 ? '' : 's') + ' to return within 3 days' });
    var hires = (st.equipmentHires || []).filter(function (h) { var d = daysFromToday(h.return_date); return h.return_date && ['returned', 'cancelled'].indexOf(h.hire_status) < 0 && d !== null && d <= 3; });
    if (hires.length) items.push({ tone: 'warn', pane: 'equipmenthire', count: hires.length, text: 'hired item' + (hires.length === 1 ? '' : 's') + ' due back within 3 days' });
    var box = $('v7Attention');
    if (!box) { box = document.createElement('div'); box.id = 'v7Attention'; box.className = 'v7-attention'; }
    var v4 = $('v4Dashboard');
    if (v4 && v4.parentNode === pane) pane.insertBefore(box, v4); else pane.insertBefore(box, pane.firstChild);
    if (!items.length) {
      box.innerHTML = '<div class="v7-att-ok"><i class="ti ti-circle-check" aria-hidden="true"></i> Nothing needs attention: no overdue invoices and no returns due in the next 3 days.</div>';
      return;
    }
    box.innerHTML = '<h3 class="v7-att-title">Needs attention</h3><div class="v7-att-list">' + items.map(function (x) {
      return '<button type="button" class="v7-att v7-att-' + x.tone + '" data-pane="' + x.pane + '"><b>' + x.count + '</b><span>' + escH(x.text) + (x.amt ? '<small>' + (has('managerMoney') ? window.managerMoney(x.amt) : x.amt) + ' outstanding</small>' : '') + '</span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>';
    }).join('') + '</div>';
    box.querySelectorAll('[data-pane]').forEach(function (b) { b.onclick = function () { window.showManagerPane(b.getAttribute('data-pane')); }; });
  }
  if (has('renderManagerDashboard')) {
    var origDash = window.renderManagerDashboard;
    window.renderManagerDashboard = function () {
      var r = origDash.apply(this, arguments);
      try { renderAttention(); } catch (e) { console.warn('attention panel', e); }
      // v4 re-inserts its dashboard asynchronously; keep the strip above it.
      setTimeout(function () { try { renderAttention(); } catch (e) {} }, 400);
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    refreshDatalist();
    decorateItemInputs();
  });
})();
