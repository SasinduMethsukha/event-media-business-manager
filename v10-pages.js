/* Event Media OS v10 — consistent A4 pages.
 *
 * The document used to be laid out at whatever width the preview area had
 * (narrower on a phone or small laptop), so the same quotation broke into a
 * different number of pages depending on the device it was exported from.
 * It is now always laid out at one width (DOC_LAYOUT_WIDTH) and only scaled
 * to fit the screen, so page breaks, PDF and print are identical everywhere.
 */
(function () {
  'use strict';
  var DOC_LAYOUT_WIDTH = 680;
  function $(id) { return document.getElementById(id); }

  function fitPreview() {
    var prev = $('preview'), pane = document.querySelector('.preview-pane');
    if (!prev || !pane) return;
    var cs = getComputedStyle(pane);
    var offscreen = cs.visibility === 'hidden' || pane.getBoundingClientRect().right < 0;
    var avail = pane.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    var doc = $('invoiceDoc');
    var w = doc ? doc.offsetWidth * (parseFloat(doc.style.zoom) || 1) : DOC_LAYOUT_WIDTH;
    var z = (!offscreen && avail > 0 && w > avail) ? avail / w : 1;
    prev.style.zoom = z < 0.999 ? String(z) : '';
  }
  window.fitPreview = fitPreview;
  // The phone preview's own fit-to-screen logic is replaced by this one.
  window.fitMobilePreview = fitPreview;

  if (typeof window.renderNow === 'function') {
    var rn = window.renderNow;
    window.renderNow = function () { var r = rn.apply(this, arguments); fitPreview(); syncGapLabels(); return r; };
  }
  // ── Row / section spacing controls ──────────────────────────────
  var GAPS = ['rowGap', 'sectionGap'];
  function syncGapLabels() {
    GAPS.forEach(function (id) {
      var el = $(id), lab = $(id + 'Val');
      if (el && lab) lab.textContent = el.value + '%';
      var q = $('q' + id), ql = $('q' + id + 'Val');
      if (el && q && q !== document.activeElement) q.value = el.value;
      if (el && ql) ql.textContent = el.value + '%';
    });
    var pc = $('qPageCount'), doc = $('invoiceDoc');
    if (pc && doc) {
      var n = doc.querySelectorAll(':scope > .doc-page').length || 1;
      pc.textContent = n + (n === 1 ? ' page' : ' pages');
    }
  }

  // Spacing bar pinned above the live preview: drag and watch the gaps change.
  // It drives the same Row / Section spacing inputs as the editor, so values
  // are saved with the document and the unsaved-changes dot lights up.
  function buildSpacingBar() {
    var pane = document.querySelector('.preview-pane');
    if (!pane || $('spacingBar')) return;
    var bar = document.createElement('div');
    bar.id = 'spacingBar'; bar.className = 'v10-spacing-bar';
    bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Document spacing');
    function slider(id, label) {
      return '<label class="v10-sb-item" title="' + label + ' (100% = normal)"><span class="v10-sb-label">' + label + '</span>' +
        '<input type="range" id="q' + id + '" min="0" max="200" step="5" value="100" aria-label="' + label + '">' +
        '<span class="v10-sb-val" id="q' + id + 'Val">100%</span></label>';
    }
    bar.innerHTML = slider('rowGap', 'Row gap') + slider('sectionGap', 'Section gap') +
      '<span class="v10-sb-pages" id="qPageCount" aria-live="polite"></span>' +
      '<button type="button" class="btn btn-sm" id="qGapReset" title="Back to the normal spacing">Reset</button>';
    pane.insertBefore(bar, pane.firstChild);
    GAPS.forEach(function (id) {
      $('q' + id).addEventListener('input', function () {
        var el = $(id); if (!el) return;
        el.value = this.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        syncGapLabels();
      });
    });
    $('qGapReset').addEventListener('click', function () {
      GAPS.forEach(function (id) {
        var el = $(id); if (!el) return;
        el.value = 100; el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      syncGapLabels();
    });
    syncGapLabels();
  }
  window.resetDocGap = function (id) {
    var el = $(id); if (!el) return;
    el.value = 100; syncGapLabels();
    if (typeof window.render === 'function') window.render();
  };
  // Older saved documents have no spacing values: open them at 100%.
  if (typeof window.applyDocSnapshot === 'function') {
    var ap = window.applyDocSnapshot;
    window.applyDocSnapshot = function (state) {
      var form = state && state.form;
      GAPS.forEach(function (id) { if (!form || !Object.prototype.hasOwnProperty.call(form, id)) { var el = $(id); if (el) el.value = 100; } });
      if (!form || !Object.prototype.hasOwnProperty.call(form, 'rowsPerPage')) { var rp = $('rowsPerPage'); if (rp) rp.value = '0'; }
      var r = ap.apply(this, arguments);
      syncGapLabels();
      return r;
    };
  }

  var t = null;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fitPreview, 120); });
  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.style.setProperty('--doc-layout-width', DOC_LAYOUT_WIDTH + 'px');
    buildSpacingBar();
    syncGapLabels();
    fitPreview();
  });
  // Re-fit when the phone preview opens/closes or the menu changes width.
  new MutationObserver(function () { fitPreview(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
