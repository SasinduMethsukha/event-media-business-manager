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
    window.renderNow = function () { var r = rn.apply(this, arguments); fitPreview(); return r; };
  }
  // ── Row / section spacing controls ──────────────────────────────
  var GAPS = ['rowGap', 'sectionGap'];
  function syncGapLabels() {
    GAPS.forEach(function (id) {
      var el = $(id), lab = $(id + 'Val');
      if (el && lab) lab.textContent = el.value + '%';
    });
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
    syncGapLabels();
    fitPreview();
  });
  // Re-fit when the phone preview opens/closes or the menu changes width.
  new MutationObserver(function () { fitPreview(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
