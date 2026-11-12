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
  var t = null;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fitPreview, 120); });
  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.style.setProperty('--doc-layout-width', DOC_LAYOUT_WIDTH + 'px');
    fitPreview();
  });
  // Re-fit when the phone preview opens/closes or the menu changes width.
  new MutationObserver(function () { fitPreview(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
