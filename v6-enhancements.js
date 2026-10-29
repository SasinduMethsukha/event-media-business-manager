/* Event Media OS v6 — reliability & usability layer.
 *
 * Loaded after every legacy script. It only wraps existing globals; no core
 * behaviour is replaced. Contents:
 *   1. Session keep-alive  - refreshes the Supabase login before it expires and
 *                            transparently retries a request that got a 401.
 *   2. Toast alerts        - window.alert() becomes a non-blocking toast.
 *   3. Draft recovery      - the open document is autosaved on this device and
 *                            can be restored after a crash, reload or closed tab.
 *   4. Unsaved-changes guard before leaving or loading another document.
 *   5. Keyboard shortcuts  - Ctrl/Cmd+S save, Esc closes dialogs.
 *   6. Mobile preview      - a Preview button on phones (preview was hidden).
 *   7. Accessibility       - icon-only buttons get accessible names.
 */
(function () {
  'use strict';

  function has(fn) { return typeof window[fn] === 'function'; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  // ─────────────────────────────────────────────────────────────
  // 1. SESSION KEEP-ALIVE
  // Supabase access tokens expire after ~1 hour. Previously every save, load
  // and manager action silently failed with 401 "JWT expired" until the user
  // logged out and back in.
  // ─────────────────────────────────────────────────────────────
  var refreshing = null;
  function refreshOnce() {
    if (!has('refreshProfileSession')) return Promise.resolve(false);
    if (!refreshing) {
      refreshing = Promise.resolve(window.refreshProfileSession())
        .catch(function () { return false; })
        .then(function (ok) {
          setTimeout(function () { refreshing = null; }, 0);
          if (!ok && has('showToast')) window.showToast('Your session has expired. Please log out and sign in again.', 'error');
          return ok;
        });
    }
    return refreshing;
  }
  function currentToken() {
    return (typeof PROFILE_SESSION !== 'undefined' && PROFILE_SESSION && PROFILE_SESSION.access_token) || '';
  }
  function isSupabaseDataUrl(u) {
    if (typeof u !== 'string' || !has('sbBase')) return false;
    var base = '';
    try { base = window.sbBase(); } catch (e) { return false; }
    if (!base || u.indexOf(base) !== 0) return false;
    return /\/(rest|storage|functions)\/v1\//.test(u);
  }
  function withToken(opts, oldToken, newToken) {
    var o = Object.assign({}, opts || {});
    var h = o.headers;
    if (h && typeof Headers !== 'undefined' && h instanceof Headers) {
      var nh = new Headers(h);
      if (nh.get('Authorization') === 'Bearer ' + oldToken) nh.set('Authorization', 'Bearer ' + newToken);
      o.headers = nh;
    } else if (h && typeof h === 'object') {
      var copy = Object.assign({}, h);
      ['Authorization', 'authorization'].forEach(function (k) {
        if (copy[k] === 'Bearer ' + oldToken) copy[k] = 'Bearer ' + newToken;
      });
      o.headers = copy;
    }
    return o;
  }
  var baseFetch = window.fetch.bind(window);
  window.fetch = async function (input, opts) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var tokenBefore = currentToken();
    var res = await baseFetch(input, opts);
    if (res.status !== 401 || !tokenBefore || typeof input !== 'string' || !isSupabaseDataUrl(url)) return res;
    var ok = await refreshOnce();
    var tokenAfter = currentToken();
    if (!ok || !tokenAfter || tokenAfter === tokenBefore) return res;
    return baseFetch(input, withToken(opts, tokenBefore, tokenAfter));
  };
  function maybeRefreshSoon() {
    if (typeof PROFILE_SESSION === 'undefined' || !PROFILE_SESSION || !PROFILE_SESSION.refresh_token) return;
    var exp = Number(PROFILE_SESSION.expires_at || 0) * 1000;
    if (!exp && PROFILE_SESSION.expires_in) return; // no absolute expiry known; the 401 retry covers it
    if (exp && exp - Date.now() < 5 * 60 * 1000) refreshOnce();
  }
  setInterval(maybeRefreshSoon, 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') maybeRefreshSoon(); });
  window.addEventListener('online', function () { maybeRefreshSoon(); if (has('showToast')) showToast('Back online', 'success', 2500); });
  window.addEventListener('offline', function () { if (has('showToast')) showToast('You are offline. Changes cannot be saved to the cloud until the connection is back.', 'error'); });

  // ─────────────────────────────────────────────────────────────
  // 2. TOAST ALERTS
  // confirm()/prompt() stay native because the code depends on their answers.
  // ─────────────────────────────────────────────────────────────
  if (has('showToast')) {
    window.alert = function (msg) { window.showToast(msg); };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. DRAFT RECOVERY (this device only)
  // ─────────────────────────────────────────────────────────────
  var DRAFT_KEY = 'eventmedia:editorDraft:v1';
  var draftTimer = null;
  function saveDraftNow() {
    if (!window.__editorReady || !has('buildDocSnapshot')) return;
    if (has('isDocDirty') && !window.isDocDirty()) return;
    try {
      var snap = window.buildDocSnapshot();
      var payload = JSON.stringify({ v: 1, savedAt: new Date().toISOString(), docNumManual: !!window.docNumManual, snapshot: snap });
      if (!lsSet(DRAFT_KEY, payload)) {
        // Quota exceeded (usually a very large uploaded logo) - retry without it.
        snap.logoData = '';
        lsSet(DRAFT_KEY, JSON.stringify({ v: 1, savedAt: new Date().toISOString(), docNumManual: !!window.docNumManual, snapshot: snap, logoDropped: true }));
      }
    } catch (e) { /* drafts are best-effort */ }
  }
  function scheduleDraft() { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraftNow, 1200); }

  if (has('markDocDirty')) {
    var origDirty = window.markDocDirty;
    window.markDocDirty = function () { origDirty.apply(this, arguments); if (window.__editorReady) scheduleDraft(); };
  }
  if (has('markDocClean')) {
    var origClean = window.markDocClean;
    window.markDocClean = function () { origClean.apply(this, arguments); clearTimeout(draftTimer); if (window.__editorReady) lsDel(DRAFT_KEY); };
  }
  // Inputs that render() does not cover (e.g. notes typed before preview updates)
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (window.__editorReady && t && t.closest && t.closest('#pane-editor')) scheduleDraft();
  }, true);
  window.addEventListener('pagehide', saveDraftNow);

  function describeDraft(d) {
    var f = (d.snapshot && d.snapshot.form) || {};
    var bits = [f.docType || 'Document', f.docNum ? '#' + f.docNum : '', f.clientName ? '· ' + String(f.clientName).split('\n')[0] : ''];
    return bits.filter(Boolean).join(' ');
  }
  function offerDraft() {
    var raw = lsGet(DRAFT_KEY);
    if (!raw) return;
    var d;
    try { d = JSON.parse(raw); } catch (e) { lsDel(DRAFT_KEY); return; }
    if (!d || !d.snapshot) return;
    var age = Date.now() - new Date(d.savedAt).getTime();
    if (!(age >= 0) || age > 30 * 24 * 3600 * 1000) { lsDel(DRAFT_KEY); return; }
    var pane = document.getElementById('pane-editor');
    if (!pane || document.getElementById('draftBanner')) return;
    var when = new Date(d.savedAt);
    var bar = document.createElement('div');
    bar.id = 'draftBanner';
    bar.className = 'draft-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Unsaved draft');
    bar.innerHTML =
      '<i class="ti ti-history" aria-hidden="true"></i>' +
      '<div class="draft-banner-text"><strong>Unsaved draft found</strong><span></span></div>' +
      '<div class="draft-banner-actions"><button type="button" class="btn btn-sm btn-primary" data-act="restore"><i class="ti ti-restore"></i> Restore</button>' +
      '<button type="button" class="btn btn-sm" data-act="discard">Discard</button></div>';
    bar.querySelector('span').textContent = describeDraft(d) + ' — last edited ' + when.toLocaleString();
    pane.insertBefore(bar, pane.firstChild);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]');
      if (!b) return;
      if (b.dataset.act === 'restore') {
        window.applyDocSnapshot(d.snapshot);
        window.docNumManual = !!d.docNumManual;
        if (has('markDocDirty')) window.markDocDirty();
        if (has('showToast')) showToast(d.logoDropped ? 'Draft restored (re-upload your custom logo - it was too large to keep in the draft).' : 'Draft restored. Remember to Save it to the cloud.', 'success');
      } else {
        lsDel(DRAFT_KEY);
      }
      bar.remove();
    });
  }
  function onEditorReady() { setTimeout(offerDraft, 0); }
  if (window.__editorReady) onEditorReady(); else document.addEventListener('editor:ready', onEditorReady, { once: true });

  // ─────────────────────────────────────────────────────────────
  // 4. UNSAVED-CHANGES GUARD
  // ─────────────────────────────────────────────────────────────
  function editorIsInUse() {
    var main = document.querySelector('.main');
    return !document.body.classList.contains('employee-mode') && !!main;
  }
  function confirmDiscard(action) {
    if (!window.__editorReady || !has('isDocDirty') || !window.isDocDirty() || !editorIsInUse()) return true;
    return window.confirm('You have unsaved changes in the current document.\n\n' + action + ' anyway? (A draft copy is kept on this device and can be restored.)');
  }
  window.addEventListener('beforeunload', function (e) {
    if (!window.__editorReady || !has('isDocDirty') || !window.isDocDirty() || !editorIsInUse()) return;
    saveDraftNow();
    e.preventDefault();
    e.returnValue = '';
  });
  // Wrapped entry points ask once; nested calls (e.g. Revise -> loadSavedDoc)
  // inherit the answer, and a "Cancel" stops the whole action up front.
  var guardActive = false;
  function guard(name, action) {
    if (!has(name)) return;
    var orig = window[name];
    window[name] = function () {
      if (guardActive) return orig.apply(this, arguments);
      if (!confirmDiscard(action)) return;
      saveDraftNow();
      guardActive = true;
      var r;
      try { r = orig.apply(this, arguments); } catch (err) { guardActive = false; throw err; }
      Promise.resolve(r).then(function () { guardActive = false; }, function () { guardActive = false; });
      return r;
    };
  }
  guard('loadSavedDoc', 'Open another document');
  guard('loadDocAsRevision', 'Open another document');
  guard('loadManagerInvoice', 'Open this invoice');
  guard('fxReviseQuote', 'Open this quotation');
  guard('fxConvert', 'Convert this quotation');
  guard('loadTemplate', 'Load this template');
  guard('pullFromSupabase', 'Replace the editor with the cloud copy');

  // ─────────────────────────────────────────────────────────────
  // 5. KEYBOARD SHORTCUTS
  // ─────────────────────────────────────────────────────────────
  function visible(el) { return !!(el && el.offsetParent !== null); }
  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
      var gate = document.getElementById('authGate');
      if (gate && gate.style.display !== 'none') return;
      var main = document.querySelector('.main');
      if (visible(main) && has('saveCurrentDoc')) {
        e.preventDefault();
        var btn = document.getElementById('saveDocBtn');
        if (!btn || !btn.disabled) window.saveCurrentDoc();
      }
      return;
    }
    if (e.key === 'Escape') {
      var dyn = document.getElementById('adminEditModal') || document.getElementById('dbRecordModal');
      if (dyn) { dyn.remove(); e.preventDefault(); return; }
      var open = document.querySelectorAll('.manager-modal.open');
      if (open.length) {
        var top = open[open.length - 1];
        var closer = { paymentReceiptModal: 'closePaymentReceiptModal', receiptDocModal: 'closeReceiptDocModal', invoiceHistoryModal: 'closeInvoiceHistoryModal', paymentModal: 'closePaymentModal', aiQuoteModal: 'closeAiQuoteModal', aiKeyModal: 'closeAiKeySettings' }[top.id];
        if (closer && has(closer)) window[closer](); else top.classList.remove('open');
        e.preventDefault();
        return;
      }
      if (document.body.classList.contains('mobile-preview')) { setMobilePreview(false); e.preventDefault(); }
    }
  });
  // Native Ctrl+P / browser menu printing: make sure the preview is current.
  // Pages are paginated for the on-screen width; scale them to A4's printable
  // width (190mm at 96dpi ≈ 718px) so every sheet lands on exactly one page.
  window.addEventListener('beforeprint', function () {
    if (has('flushRender')) window.flushRender();
    var doc = document.getElementById('invoiceDoc');
    var pane = document.querySelector('.preview-pane');
    if (!doc || !pane) return;
    var w = doc.getBoundingClientRect().width;
    if (!w) return;
    var innerZoom = parseFloat(doc.style.zoom) || 1;
    pane.style.setProperty('--print-doc-width', (w / innerZoom) + 'px');
    pane.style.setProperty('--print-zoom', String(Math.min(1.5, (718 / w) * 0.985)));
  });

  // ─────────────────────────────────────────────────────────────
  // 6. MOBILE PREVIEW
  // On narrow screens the preview was display:none, so it could not be seen
  // and PDF export lost its page breaks. It is now rendered off-screen and can
  // be opened full screen.
  // ─────────────────────────────────────────────────────────────
  function setMobilePreview(on) {
    document.body.classList.toggle('mobile-preview', !!on);
    var fab = document.getElementById('mobilePreviewBtn');
    if (fab) {
      fab.innerHTML = on ? '<i class="ti ti-pencil"></i> Edit' : '<i class="ti ti-eye"></i> Preview';
      fab.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    var main = document.querySelector('.main');
    if (has('renderNow') && main && main.style.display !== 'none') window.renderNow();
    fitMobilePreview();
    if (on) window.scrollTo(0, 0);
  }
  // Scale the A4 preview down to the phone's width instead of making the user
  // scroll sideways. Exports measure offsetWidth, so this does not affect them.
  function fitMobilePreview() {
    var prev = document.getElementById('preview');
    var doc = document.getElementById('invoiceDoc');
    if (!prev) return;
    if (!document.body.classList.contains('mobile-preview') || !doc) { prev.style.zoom = ''; return; }
    var w = doc.offsetWidth * (parseFloat(doc.style.zoom) || 1);
    var avail = window.innerWidth - 20;
    prev.style.zoom = (w > avail && w > 0) ? String(avail / w) : '';
  }
  window.fitMobilePreview = fitMobilePreview;
  window.setMobilePreview = setMobilePreview;
  function addMobilePreviewButton() {
    if (document.getElementById('mobilePreviewBtn')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'mobilePreviewBtn';
    b.className = 'mobile-preview-fab';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<i class="ti ti-eye"></i> Preview';
    b.onclick = function () { setMobilePreview(!document.body.classList.contains('mobile-preview')); };
    document.body.appendChild(b);
  }

  // Re-paginate when the window size changes enough to change page width.
  var lastW = window.innerWidth, resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (Math.abs(window.innerWidth - lastW) > 40 && has('renderNow') && window.__editorReady) {
        lastW = window.innerWidth;
        window.renderNow(); // renderNow() re-paginates without marking the document as changed
        fitMobilePreview();
      }
    }, 250);
  });

  // ─────────────────────────────────────────────────────────────
  // 7. ACCESSIBILITY & SMALL UX FIXES
  // ─────────────────────────────────────────────────────────────
  function labelIconButtons(root) {
    (root || document).querySelectorAll('button[title]:not([aria-label]), .btn-icon[title]:not([aria-label])').forEach(function (b) {
      if (!b.textContent.trim()) b.setAttribute('aria-label', b.getAttribute('title'));
    });
  }
  var labelTimer = null;
  var mo = new MutationObserver(function () { clearTimeout(labelTimer); labelTimer = setTimeout(function () { labelIconButtons(document); }, 120); });

  // Opening the Business Manager kept the editor's scroll position, so its
  // header appeared tucked under the top bar.
  ['openManager', 'closeManager'].forEach(function (name) {
    if (!has(name)) return;
    var orig = window[name];
    window[name] = function () {
      var r = orig.apply(this, arguments);
      window.scrollTo(0, 0);
      var mv = document.getElementById('managerView');
      document.body.classList.toggle('manager-open', !!(mv && mv.style.display !== 'none'));
      if (name === 'openManager' && document.body.classList.contains('mobile-preview')) setMobilePreview(false);
      // The preview cannot paginate while hidden, so refresh it on return.
      if (name === 'closeManager' && has('renderNow') && window.__editorReady) window.renderNow();
      return r;
    };
  });

  document.addEventListener('DOMContentLoaded', function () {
    addMobilePreviewButton();
    labelIconButtons(document);
    mo.observe(document.body, { childList: true, subtree: true });
    var save = document.getElementById('saveDocBtn');
    if (save && !save.title) save.title = 'Save to cloud (Ctrl+S)';
  });
})();
