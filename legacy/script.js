var accent = '#c0392b';
var cats = [];
var eventDates = [''];
var catId = 0;
var dark = false;
var colLabels = {desc:'Description', tag:'Tag', qty:'Qty', unit:'Unit', total:'Total'};
var PAYMENT_DEFAULTS = {
  bank: 'Seylan Bank, Maharagama',
  accName: 'Event Media Production (Pvt) Ltd',
  accNo: '004013851563001'
};
var CAT_COLORS = ['#c0392b','#1a56db','#087f5b','#862e9c','#e67700','#0b7285','#2b2d42','#d6336c'];

var TEMPLATES = [
  {name:'AV & Events', icon:'ti-device-speaker', desc:'Sound, lighting, staging, streaming', cats:[
    {name:'Technical Infrastructure', items:[['Sound System','Hardware',1,85000],['Intelligent Lighting','Hardware',1,120000],['Staging & Rigging','Hardware',1,55000],['LED Wall','Hardware',1,175000]]},
    {name:'Media Production', items:[['Multi-Camera Production','Services',1,145000],['Live Streaming','Services',1,85000],['Recording','Services',1,45000]]}
  ]},
  {name:'Web Agency', icon:'ti-code', desc:'Design, dev, SEO, hosting', cats:[
    {name:'Design', items:[['UI/UX Design','Creative',1,210000],['Brand Guidelines','Creative',1,75000]]},
    {name:'Development', items:[['Frontend Dev','Dev',1,350000],['Backend API','Dev',1,300000],['QA Testing','Dev',1,65000]]},
    {name:'SEO & Support', items:[['SEO Package','Services',3,45000],['Hosting','Services',12,15000]]}
  ]},
  {name:'Photography', icon:'ti-camera', desc:'Shoot day, editing, delivery', cats:[
    {name:'Shoot Day', items:[['Studio Hire','Venue',1,40000],['Lead Photographer','Labour',1,80000],['Second Shooter','Labour',1,40000]]},
    {name:'Post Production', items:[['Retouching','Services',100,500],['Online Gallery','Services',1,8000],['Album Design','Creative',1,25000]]}
  ]},
  {name:'Consulting', icon:'ti-chart-line', desc:'Strategy, research, advisory', cats:[
    {name:'Discovery', items:[['Stakeholder Interviews','Advisory',8,25000],['Data Audit','Advisory',1,55000]]},
    {name:'Delivery', items:[['Market Analysis','Report',1,120000],['Roadmap Document','Report',1,95000],['Executive Presentation','Creative',1,45000]]}
  ]},
  {name:'Construction', icon:'ti-building', desc:'Labour, materials, equipment', cats:[
    {name:'Labour', items:[['Site Supervisor','Labour',30,8000],['Skilled Workers','Labour',60,4500]]},
    {name:'Materials', items:[['Cement 50kg bags','Materials',200,1800],['Steel kg','Materials',500,450]]}
  ]},
  {name:'Blank', icon:'ti-file-plus', desc:'Start from scratch', cats:[
    {name:'Category 1', items:[['Item description','General',1,0]]}
  ]}
];

// ── INIT ──
window.addEventListener('DOMContentLoaded', async function() {
  if (location.protocol === 'file:') {
    try {
      var testKey = 'invoicegen:storagetest';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
    } catch (e) {
      var warn = document.createElement('div');
      warn.style.cssText = 'background:#fee2e2;color:#7f1d1d;padding:.6rem 1rem;font-size:12.5px;text-align:center;border-bottom:1px solid #fca5a5';
      warn.textContent = 'Your browser is blocking local storage for files opened this way. Saved documents will not persist - use Export Backup after saving, or host this file on a web server instead.';
      document.body.insertBefore(warn, document.body.firstChild);
    }
  }
  var today = localISODate();
  var due = addDaysISO(today, 30);
  document.getElementById('issueDate').value = today;
  document.getElementById('dueDate').value = due;
  renderEventDates();
  // Load Supabase credentials first so the initial number lookup can hit the cloud
  loadSupabaseCreds();
  updateSbBanner();
  document.getElementById('docNum').value = '…';
  try {
    document.getElementById('docNum').value = await generateDocNumber(gv('docType'), false);
  } catch (e) {
    document.getElementById('docNum').value = '';
  }
  docNumManual = false;
  // Set embedded logo
  document.getElementById('logoThumb').src = LOGO_DATA;
  document.getElementById('logoPreviewWrap').style.display = '';
  document.getElementById('logoUploadArea').style.display = 'none';
  renderTemplates();
  loadTemplate(0);
  render();
  markDocClean();
  window.__editorReady = true;
  document.dispatchEvent(new CustomEvent('editor:ready'));
});

// ── UTILS ──
// Calendar dates in the user's own timezone. new Date().toISOString() is UTC,
// which in Sri Lanka (UTC+5:30) reports *yesterday* until 05:30 every morning -
// wrong issue dates, wrong "overdue" flags and the wrong month in reports.
function localISODate(d) {
  d = d ? new Date(d) : new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function localISOMonth(d) { return localISODate(d).slice(0, 7); }
function addDaysISO(iso, days) {
  var p = String(iso || '').split('-').map(Number);
  var d = (p.length === 3 && p[0]) ? new Date(p[0], p[1] - 1, p[2]) : new Date();
  d.setDate(d.getDate() + (Number(days) || 0));
  return localISODate(d);
}
// ── TOASTS ──
// Non-blocking notifications. window.alert() is routed through here too (see
// v6-enhancements.js) so success messages no longer freeze the page.
function showToast(message, type, ms) {
  try {
    var host = document.getElementById('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    var text = String(message == null ? '' : message);
    if (!type) type = /fail|error|could not|cannot|can't|invalid|denied|required|please|not found|exceeds/i.test(text) ? 'error' : 'info';
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    var icon = type === 'success' ? 'ti-circle-check' : (type === 'error' ? 'ti-alert-triangle' : 'ti-info-circle');
    el.innerHTML = '<i class="ti ' + icon + '" aria-hidden="true"></i><div class="toast-msg"></div><button type="button" class="toast-close" aria-label="Dismiss">&times;</button>';
    el.querySelector('.toast-msg').textContent = text;
    var close = function() { if (!el.parentNode) return; el.classList.add('toast-out'); setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 220); };
    el.querySelector('.toast-close').onclick = close;
    host.appendChild(el);
    while (host.children.length > 4) host.removeChild(host.firstChild);
    var dur = ms || Math.min(12000, Math.max(3500, text.length * 55)) + (type === 'error' ? 2500 : 0);
    setTimeout(close, dur);
  } catch (e) { console.log(message); }
}

// ── UNSAVED-CHANGE TRACKING ──
var _docDirty = false;
function markDocDirty() {
  _docDirty = true;
  var b = document.getElementById('saveDocBtn');
  if (b) b.classList.add('has-unsaved');
}
function markDocClean() {
  _docDirty = false;
  var b = document.getElementById('saveDocBtn');
  if (b) b.classList.remove('has-unsaved');
}
function isDocDirty() { return _docDirty; }
// Escapes a message for safe insertion into innerHTML (error texts can contain
// raw server responses).
function escMsg(e) { return esc(e && e.message ? e.message : e); }
function gv(id) { var e = document.getElementById(id); return e ? e.value : ''; }
function gvFlat(id) { return gv(id).replace(/\n+/g, ' - '); }
function gc(id) { var e = document.getElementById(id); return e ? e.checked : false; }
function esc(s) {
  // Note: 0 must render as "0", not "" (previously String(0||'') dropped it).
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmt(n) {
  var sym = gv('currency') || 'Rs. ';
  return sym + parseFloat(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function rgba(hex,a) {
  var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}
function itemTotal(it) {
  if (it.manualTotal) return parseFloat(it.total)||0;

  // Multi-day items use a manually entered total price.
  if (it.multiDay) {
    var multiDayPrice = parseFloat(it.multiDayPrice);
    return isFinite(multiDayPrice) ? multiDayPrice : 0;
  }

  var qty = parseFloat(it.qty);
  var unit = parseFloat(it.unit);
  if (!isFinite(qty)) qty = 1;
  if (!isFinite(unit)) unit = 0;
  return qty * unit;
}


// ── MULTIPLE EVENT DATES ──
function renderEventDates() {
  var wrap = document.getElementById('eventDatesList');
  if (!wrap) return;
  if (!Array.isArray(eventDates) || !eventDates.length) eventDates = [''];

  wrap.innerHTML = eventDates.map(function(date, idx) {
    var removeBtn = eventDates.length > 1
      ? '<button type="button" class="btn-icon" onclick="removeEventDate(' + idx + ')" title="Remove date"><i class="ti ti-x"></i></button>'
      : '';
    return '<div class="event-date-row">' +
      '<input type="date" value="' + esc(date || '') + '" oninput="updateEventDate(' + idx + ',this.value)">' +
      removeBtn +
      '</div>';
  }).join('');
}

function addEventDate() {
  eventDates.push('');
  renderEventDates();
  var rows = document.querySelectorAll('#eventDatesList .event-date-row input');
  if (rows.length) rows[rows.length - 1].focus();
  render();
}

function removeEventDate(idx) {
  if (eventDates.length <= 1) {
    eventDates = [''];
  } else {
    eventDates.splice(idx, 1);
  }
  renderEventDates();
  render();
}

function updateEventDate(idx, value) {
  eventDates[idx] = value;
  render();
}

function getActiveEventDates() {
  return (eventDates || []).filter(function(d){ return String(d || '').trim(); });
}

// ── THEME / PANES / ACCENT ──
function toggleTheme() {
  dark = !dark;
  document.documentElement.setAttribute('data-theme', dark?'dark':'');
  document.getElementById('themeBtn').innerHTML = dark ? '<i class="ti ti-sun"></i> Light' : '<i class="ti ti-moon"></i> Dark';
}
function showPane(p) {
  ['editor','templates','gsheets','cloud','history'].forEach(function(x) {
    document.getElementById('pane-'+x).style.display = x===p ? '' : 'none';
    document.getElementById('tab-'+x).classList.toggle('active', x===p);
  });
  if (p === 'history') refreshHistoryList();
}
function setAccent(c) {
  accent = c;
  document.querySelectorAll('.swatch').forEach(function(s) {
    s.classList.toggle('active', (s.style.background||'') === c);
  });
  render();
}
function setDocType(t) { document.getElementById('docType').value = t; onDocTypeChange(); }
async function onDocTypeChange() {
  var type = gv('docType');
  if (type === 'Invoice') {
    if (!gv('payBank').trim()) document.getElementById('payBank').value = PAYMENT_DEFAULTS.bank;
    if (!gv('payAccName').trim()) document.getElementById('payAccName').value = PAYMENT_DEFAULTS.accName;
    if (!gv('payAccNo').trim()) document.getElementById('payAccNo').value = PAYMENT_DEFAULTS.accNo;
    if (!gc('showPayment')) {
      document.getElementById('showPayment').checked = true;
      toggleField('paymentFieldWrap', true);
    }
  }
  // Give this doc type its own next number, unless the person has typed a custom one
  if (!docNumManual) {
    var el = document.getElementById('docNum');
    el.value = '…';
    try {
      el.value = await generateDocNumber(type, false);
    } catch (e) {
      el.value = '';
    }
  }
  render();
}

// ── AUTO DOCUMENT NUMBERING ──
// Quotation/Proforma/PO/Credit Note use PREFIX-YYYY-NNN (e.g. QUO-2026-228).
// Invoice uses PREFIX-YYYYMM-NNN (e.g. INV-202607-009) so it resets each month.
// When Supabase is connected, the next number is worked out by looking at the
// highest existing doc_number of that type/period already saved in the cloud
// for this workspace, compared against a local "starting number" floor (so
// numbers already issued outside this app aren't reused) — whichever is
// higher wins. Falls back to the local floor alone if Supabase isn't set up
// yet or a lookup fails, so numbering never blocks on the network.
var docNumManual = false;
var DOC_PREFIXES = {
  'Quotation': 'QUO',
  'Invoice': '',
  'Proforma Invoice': 'PRO',
  'Purchase Order': 'PO',
  'Credit Note': 'CN',
  'Payment Received': 'PR'
};
var DOC_PERIOD_MODE = { 'Invoice': 'month' }; // anything not listed here uses 'year'
// One-time bootstrap so numbering continues correctly from what's already
// been issued outside this app. Only used the first time a browser/device
// has no local counter yet for that type+period — after that, the real
// counter (local or cloud) takes over. Safe to leave in place indefinitely.
var SEED_FLOORS = {
  'Quotation:2026': 227,
  'Invoice:202607': 8,
  'Payment Received:2026': 0
};
function docPrefix(type) { return (type in DOC_PREFIXES) ? DOC_PREFIXES[type] : 'DOC'; }
function formatDocNumber(prefix, period, n) {
  var digits = (prefix === 'PR') ? 4 : 3;
  return (prefix ? prefix + '-' : '') + period + '-' + String(n).padStart(digits, '0');
}
function docPeriod(type) {
  var now = new Date();
  var year = String(now.getFullYear());
  if (DOC_PERIOD_MODE[type] === 'month') {
    return year + String(now.getMonth() + 1).padStart(2, '0');
  }
  return year;
}
function docSeqKey(type) {
  return 'invoicegen:seq:' + (type || 'Doc') + ':' + docPeriod(type);
}
function localFloor(type) {
  var n = 0;
  try { n = parseInt(localStorage.getItem(docSeqKey(type)), 10) || 0; } catch (e) {}
  if (!n) n = SEED_FLOORS[type + ':' + docPeriod(type)] || 0;
  return n;
}
async function cloudMaxSeq(type, prefix, period) {
  var pattern = (prefix ? prefix + '-' : '') + period + '-';
  var isReceipt = (type === 'Payment Received' || prefix === 'PR');
  var table = isReceipt ? 'payment_receipts' : 'invoice_documents';
  var col = isReceipt ? 'receipt_no' : 'doc_number';
  var url = sbBase() + '/rest/v1/' + table +
    '?workspace_id=eq.' + encodeURIComponent(gv('sbWorkspace').trim()) +
    '&' + col + '=like.' + encodeURIComponent(pattern + '*') +
    '&select=' + col + '&limit=1000';
  var r = await fetch(url, { headers: sbHeaders(gv('sbKey').trim()) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  var rows = await r.json();
  var max = 0;
  rows.forEach(function(row) {
    var val = row[col];
    var m = val && val.match(/-(\d+)$/);
    if (m) { var v = parseInt(m[1], 10); if (v > max) max = v; }
  });
  return max;
}
async function generateDocNumber(type, commit) {
  var prefix = docPrefix(type), period = docPeriod(type);
  var floor = localFloor(type);
  var n = floor + 1;
  if (sbConfigured()) {
    try {
      var cloudMax = await cloudMaxSeq(type, prefix, period);
      n = Math.max(floor, cloudMax) + 1;
    } catch (e) {
      console.warn('Cloud numbering lookup failed, using local starting number instead', e);
    }
  }
  if (commit) {
    try { localStorage.setItem(docSeqKey(type), String(n)); } catch (e) {}
  }
  return formatDocNumber(prefix, period, n);
}
// Numbers are only *previewed* while editing. The local counter moves forward
// when a document is actually saved (see commitDocNumber), so reloading the
// page or flipping the document type no longer skips numbers.
function commitDocNumber(type, docNum) {
  var prefix = docPrefix(type), period = docPeriod(type);
  var head = (prefix ? prefix + '-' : '') + period + '-';
  var num = String(docNum || '').trim();
  if (num.indexOf(head) !== 0) return false;
  var m = num.slice(head.length).match(/^(\d+)/);
  if (!m) return false;
  var n = parseInt(m[1], 10);
  if (n > localFloor(type)) {
    try { localStorage.setItem(docSeqKey(type), String(n)); } catch (e) {}
  }
  return true;
}
async function generateReceiptNumber(commit) {
  return generateDocNumber('Payment Received', commit);
}
async function regenerateDocNum() {
  var el = document.getElementById('docNum');
  var prev = el.value;
  el.value = '…';
  try {
    el.value = await generateDocNumber(gv('docType'), false);
  } catch (e) {
    el.value = prev;
  }
  docNumManual = false;
  render();
}
function setStartingNumber() {
  var type = gv('docType');
  var period = docPeriod(type);
  var current = localFloor(type);
  var label = type + ' (' + (docPrefix(type) ? docPrefix(type) + '-' : '') + period + ')';
  var val = prompt('Enter the last number already issued for ' + label + '.\nThe next document generated will continue from there (e.g. entering 8 makes the next one 009).', current);
  if (val === null) return;
  var num = parseInt(val, 10);
  if (isNaN(num) || num < 0) { alert('Please enter a valid whole number.'); return; }
  try { localStorage.setItem(docSeqKey(type), String(num)); } catch (e) {}
  if (!docNumManual) regenerateDocNum();
}
function bumpDocRevision(docNum) {
  var num = (docNum !== undefined ? docNum : (gv('docNum') || '')).trim();
  if (!num) return num;

  var revMatch = num.match(/[-_ ](?:rev|r)(\d+)$/i);
  if (revMatch) {
    var currentRev = parseInt(revMatch[1], 10);
    var nextRev = currentRev + 1;
    var base = num.slice(0, revMatch.index);
    var matchedText = num.slice(revMatch.index);
    var separator = matchedText.charAt(0);
    var isR = /^[-_ ]r\d+$/i.test(matchedText) && !/^[-_ ]rev/i.test(matchedText);
    return base + separator + (isR ? 'R' : 'Rev') + nextRev;
  }

  return num + '-Rev1';
}
function createDocRevision() {
  var el = document.getElementById('docNum');
  var currentNum = (el ? el.value : '').trim();
  if (!currentNum) {
    alert('Please enter or generate a document number first.');
    return;
  }
  var newNum = bumpDocRevision(currentNum);
  if (el) el.value = newNum;
  docNumManual = true;
  render();
  alert('Revision document number set to: ' + newNum + '\n\nEdit your items (add or remove items) and press Save. The original document (' + currentNum + ') remains intact in your database.');
}
function toggleField(id, show) { document.getElementById(id).style.display = show ? '' : 'none'; }

// ── LOGO ──
function updateLogoSize() {
  var sz = document.getElementById('logoSize').value;
  document.getElementById('logoSizeVal').textContent = sz + 'px';
  render();
}
function handleLogo(inp) {
  var file = inp.files[0]; if (!file) return;
  var r = new FileReader();
  r.onload = function(e) {
    LOGO_DATA = e.target.result;
    document.getElementById('logoThumb').src = LOGO_DATA;
    document.getElementById('logoPreviewWrap').style.display = '';
    document.getElementById('logoUploadArea').style.display = 'none';
    render();
  };
  r.readAsDataURL(file);
}
function clearLogo() {
  LOGO_DATA = '';
  document.getElementById('logoPreviewWrap').style.display = 'none';
  document.getElementById('logoUploadArea').style.display = '';
  document.getElementById('logoFile').value = '';
  render();
}

// ── CATEGORIES ──
function getCatType(c) {
  if (!c) return 'standard';
  if (c.type === 'removed' || c.type === 'additional') return c.type;
  var name = (c.name || '').trim().toLowerCase();
  if (/removed|deduct|cut|cancelled|omitted/i.test(name)) return 'removed';
  if (/additional|extra|add-on|addon/i.test(name)) return 'additional';
  return c.type || 'standard';
}

function addCategory(data) {
  var id = catId++;
  var type = (data && data.type) ? data.type : 'standard';
  var defaultColor = type === 'removed' ? '#dc2626' : (type === 'additional' ? '#16a34a' : CAT_COLORS[cats.length % CAT_COLORS.length]);
  var color = (data && data.color) ? data.color : defaultColor;
  var defaultName = type === 'removed' ? 'Removed Items' : (type === 'additional' ? 'Additional Items' : 'New Category');
  var name = (data && data.name) ? data.name : defaultName;

  var itemsList = [{desc:'',tag:'General',qty:1,unit:0,days:1,multiDay:false,showDesc:true,showTag:true,showQty:true,showUnit:true,showTotal:true,manualTotal:false,total:0}];
  if (data && Array.isArray(data.items)) {
    itemsList = data.items.map(function(it){
      if (Array.isArray(it)) {
        return {desc:it[0],tag:it[1],qty:it[2]||1,unit:it[3]||0,days:1,multiDay:false,showDesc:true,showTag:true,showQty:true,showUnit:true,showTotal:true,manualTotal:false,total:0};
      }
      return Object.assign({desc:'',tag:'General',qty:1,unit:0,days:1,multiDay:false,showDesc:true,showTag:true,showQty:true,showUnit:true,showTotal:true,manualTotal:false,total:0}, it);
    });
  }

  cats.push({
    id: id,
    name: name,
    type: type,
    color: color,
    discEnabled: false, discMode: 'pct', discVal: 0, discLabel: 'Discount',
    budgetEnabled: false, budgetVal: 0, budgetLabel: 'Category Budget',
    note: (data && data.note) ? data.note : '',
    items: itemsList
  });
  renderCats();
  render();

  setTimeout(function() {
    var catEl = document.querySelector('.cat-block[data-cid="' + id + '"]');
    if (catEl) {
      catEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var descInput = catEl.querySelector('.item-row input');
      if (descInput) descInput.focus();
    }
  }, 60);
}

function addAdditionalCategory() {
  addCategory({ name: 'Additional Items', type: 'additional', color: '#16a34a' });
}

function addRemovedCategory() {
  addCategory({ name: 'Removed Items', type: 'removed', color: '#dc2626', note: 'Items removed from the previous proposal as requested.' });
}

function updateCatType(id, type) {
  var c = cats.find(function(x){ return String(x.id)===String(id); });
  if (!c) return;
  c.type = type;
  if (type === 'removed') {
    c.color = '#dc2626';
    if (!c.name || c.name === 'New Category') c.name = 'Removed Items';
  } else if (type === 'additional') {
    c.color = '#16a34a';
    if (!c.name || c.name === 'New Category') c.name = 'Additional Items';
  }
  renderCats();
  render();
}

function moveItemToRemoved(cId, idx) {
  var srcCat = cats.find(function(x){ return String(x.id)===String(cId); });
  if (!srcCat || !srcCat.items[idx]) return;
  var item = srcCat.items.splice(idx, 1)[0];
  var removedCat = cats.find(function(x){ return getCatType(x) === 'removed'; });
  if (!removedCat) {
    var id = catId++;
    removedCat = {
      id: id,
      name: 'Removed Items',
      type: 'removed',
      color: '#dc2626',
      discEnabled: false, discMode: 'pct', discVal: 0, discLabel: 'Discount',
      budgetEnabled: false, budgetVal: 0, budgetLabel: 'Category Budget',
      note: 'Items removed as requested by customer',
      items: []
    };
    cats.push(removedCat);
  }
  removedCat.items.push(item);
  renderCats();
  render();
}

function restoreRemovedItem(cId, idx) {
  var srcCat = cats.find(function(x){ return String(x.id)===String(cId); });
  if (!srcCat || !srcCat.items[idx]) return;
  var item = srcCat.items.splice(idx, 1)[0];
  var targetCat = cats.find(function(x){ return getCatType(x) === 'standard'; });
  if (!targetCat) {
    var id = catId++;
    targetCat = {
      id: id,
      name: 'Services',
      type: 'standard',
      color: '#2563eb',
      discEnabled: false, discMode: 'pct', discVal: 0, discLabel: 'Discount',
      budgetEnabled: false, budgetVal: 0, budgetLabel: 'Category Budget',
      note: '',
      items: []
    };
    cats.unshift(targetCat);
  }
  targetCat.items.push(item);
  renderCats();
  render();
}

// ── CATEGORY & ITEM REORDERING ──
function moveCategory(index, direction) {
  if (!cats || cats.length <= 1) return;
  index = parseInt(index, 10);
  if (isNaN(index) || index < 0 || index >= cats.length) return;

  var targetIndex = index;
  if (direction === 'top') {
    targetIndex = 0;
  } else if (direction === 'bottom') {
    targetIndex = cats.length - 1;
  } else {
    targetIndex = index + direction;
  }

  if (targetIndex < 0 || targetIndex >= cats.length || targetIndex === index) return;

  var movedCat = cats.splice(index, 1)[0];
  cats.splice(targetIndex, 0, movedCat);

  renderCats();
  render();

  setTimeout(function() {
    var el = document.querySelector('.cat-block[data-cid="' + movedCat.id + '"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el.classList.add('cat-highlight-anim');
      setTimeout(function() { el.classList.remove('cat-highlight-anim'); }, 650);
    }
  }, 40);
}

function moveItem(cId, itemIdx, direction) {
  var c = cats.find(function(x) { return String(x.id) === String(cId); });
  if (!c || !c.items || c.items.length <= 1) return;
  itemIdx = parseInt(itemIdx, 10);
  if (isNaN(itemIdx) || itemIdx < 0 || itemIdx >= c.items.length) return;

  var targetIdx = itemIdx;
  if (direction === 'top') {
    targetIdx = 0;
  } else if (direction === 'bottom') {
    targetIdx = c.items.length - 1;
  } else {
    targetIdx = itemIdx + direction;
  }

  if (targetIdx < 0 || targetIdx >= c.items.length || targetIdx === itemIdx) return;

  var movedItem = c.items.splice(itemIdx, 1)[0];
  c.items.splice(targetIdx, 0, movedItem);

  renderCats();
  render();

  setTimeout(function() {
    var row = document.querySelector('tr.item-row[data-cid="' + cId + '"][data-idx="' + targetIdx + '"]');
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      row.classList.add('item-highlight-anim');
      setTimeout(function() { row.classList.remove('item-highlight-anim'); }, 650);
    }
  }, 40);
}

// Drag & Drop handlers
var _draggedCatIdx = null;
var _draggedItemInfo = null;

function onCatDragStart(e, idx) {
  _draggedCatIdx = idx;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'cat:' + idx);
  }
  var el = e.currentTarget.closest('.cat-block');
  if (el) el.classList.add('dragging');
}

function onCatDragEnd(e) {
  _draggedCatIdx = null;
  document.querySelectorAll('.cat-block').forEach(function(b) {
    b.classList.remove('dragging', 'drag-over');
  });
}

function onCatDragOver(e) {
  if (_draggedCatIdx === null) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  var block = e.currentTarget.closest('.cat-block');
  if (block) block.classList.add('drag-over');
}

function onCatDragLeave(e) {
  var block = e.currentTarget.closest('.cat-block');
  if (block) block.classList.remove('drag-over');
}

function onCatDrop(e, targetIdx) {
  e.preventDefault();
  if (_draggedCatIdx === null || _draggedCatIdx === targetIdx) return;
  var fromIdx = _draggedCatIdx;
  _draggedCatIdx = null;
  document.querySelectorAll('.cat-block').forEach(function(b) {
    b.classList.remove('dragging', 'drag-over');
  });

  var movedCat = cats.splice(fromIdx, 1)[0];
  cats.splice(targetIdx, 0, movedCat);

  renderCats();
  render();
}

function onItemDragStart(e, cId, idx) {
  _draggedItemInfo = { cId: cId, idx: idx };
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'item:' + cId + ':' + idx);
  }
  var row = e.currentTarget.closest('tr.item-row');
  if (row) row.classList.add('dragging');
}

function onItemDragEnd(e) {
  _draggedItemInfo = null;
  document.querySelectorAll('tr.item-row').forEach(function(r) {
    r.classList.remove('dragging', 'drag-over');
  });
}

function onItemDragOver(e) {
  if (!_draggedItemInfo) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  var row = e.currentTarget.closest('tr.item-row');
  if (row) row.classList.add('drag-over');
}

function onItemDragLeave(e) {
  var row = e.currentTarget.closest('tr.item-row');
  if (row) row.classList.remove('drag-over');
}

function onItemDrop(e, targetCId, targetItemIdx) {
  e.preventDefault();
  if (!_draggedItemInfo) return;
  var fromCId = _draggedItemInfo.cId;
  var fromIdx = _draggedItemInfo.idx;
  _draggedItemInfo = null;
  document.querySelectorAll('tr.item-row').forEach(function(r) {
    r.classList.remove('dragging', 'drag-over');
  });

  var srcCat = cats.find(function(x) { return String(x.id) === String(fromCId); });
  var destCat = cats.find(function(x) { return String(x.id) === String(targetCId); });
  if (!srcCat || !destCat || !srcCat.items[fromIdx]) return;

  var movedItem = srcCat.items.splice(fromIdx, 1)[0];
  destCat.items.splice(targetItemIdx, 0, movedItem);

  renderCats();
  render();
}

function removeCategory(id) { cats = cats.filter(function(c){ return String(c.id)!==String(id); }); renderCats(); render(); }

function updateCategoryNote(id, val) {
  var c = cats.find(function(x){ return x.id===id; });
  if (!c) return;
  c.note = val;
  // Only refresh the quotation/invoice preview.
  // Do not call renderCats() here, otherwise the textarea loses focus while typing.
  render();
}
function addItem(cId) {
  var c = cats.find(function(x){ return x.id===cId; });
  if (c) c.items.push({desc:'',tag:'General',qty:1,unit:0,days:1,multiDay:false,showDesc:true,showTag:true,showUnit:true,showQty:true,showTotal:true,manualTotal:false,total:0});
  renderCats(); render();
}
function removeItem(cId, idx) {
  var c = cats.find(function(x){ return x.id===cId; });
  if (c) c.items.splice(idx,1);
  renderCats(); render();
}
function toggleItemVis(cId, idx, field) {
  var c = cats.find(function(x){ return x.id===cId; });
  if (!c || !c.items[idx]) return;
  var cur = c.items[idx][field] !== false;
  c.items[idx][field] = !cur;
  renderCats(); render();
}
function updateCatField(id, field, val) {
  var c = cats.find(function(x){ return String(x.id)===String(id); });
  if (!c) return;
  if (field === 'discVal' || field === 'budgetVal') c[field] = parseFloat(val)||0;
  else c[field] = val;
  if (field === 'name') {
    var detected = getCatType(c);
    if (detected !== 'standard' && (!c.type || c.type === 'standard')) {
      c.type = detected;
      if (detected === 'removed') c.color = '#dc2626';
      if (detected === 'additional') c.color = '#16a34a';
    }
  }
  render();
}
function toggleCatDisc(id) {
  var c = cats.find(function(x){ return String(x.id)===String(id); });
  if (!c) return;
  c.discEnabled = !c.discEnabled;
  renderCats(); render();
}
function toggleCatBudget(id) {
  var c = cats.find(function(x){ return String(x.id)===String(id); });
  if (!c) return;
  c.budgetEnabled = !c.budgetEnabled;
  if (c.budgetEnabled && !c.budgetVal) {
    // seed with the current computed subtotal so it's a sensible starting point
    var rawSub = c.items.reduce(function(a,it){ return a+Math.abs(itemTotal(it)); }, 0);
    c.budgetVal = rawSub;
  }
  var budgetRow = document.getElementById('catBudgetRow_'+id);
  if (budgetRow) budgetRow.style.display = c.budgetEnabled ? 'flex' : 'none';
  renderCats();
  render();
}
function updateItem(cId, idx, field, val) {
  var c = cats.find(function(x){ return String(x.id)===String(cId); });
  if (!c || !c.items[idx]) return;

  var it = c.items[idx];
  it[field] = (field==='qty'||field==='unit'||field==='total'||field==='days'||field==='multiDayPrice')
    ? (parseFloat(val)||0)
    : val;

  // IMPORTANT: do not call renderCats() while the user is typing.
  // Rebuilding #categories on every keystroke replaces the active input
  // and makes the field lose focus after each character.
  var row = document.querySelector('tr.item-row[data-cid="' + cId + '"][data-idx="' + idx + '"]');
  if (row) {
    var totalEl = row.querySelector('.item-line-total');
    if (totalEl && !it.manualTotal) {
      var isCatRem = getCatType(c) === 'removed';
      var valAmt = Math.abs(itemTotal(it));
      totalEl.textContent = (isCatRem ? '− ' : '') + valAmt.toLocaleString('en-US',{
        minimumFractionDigits:2,
        maximumFractionDigits:2
      });
    }

    var daysBtn = row.querySelector('.multi-day-toggle');
    if (daysBtn && it.multiDay) {
      var effectiveDays = parseFloat(it.days);
      if (!isFinite(effectiveDays) || effectiveDays < 1) effectiveDays = 1;
      daysBtn.innerHTML = '<i class="ti ti-calendar-time" style="font-size:12px"></i> ' + effectiveDays + ' day' + (effectiveDays===1?'':'s');
    }
  }

  var multiRow = document.querySelector('tr.multi-day-row[data-cid="' + cId + '"][data-idx="' + idx + '"]');
  if (multiRow) {
    var priceDisplay = multiRow.querySelector('.multi-day-price-display');
    if (priceDisplay) {
      var sym = (gv('currency')||'Rs. ').trim();
      priceDisplay.textContent = sym + ' ' + itemTotal(it).toLocaleString('en-US',{
        minimumFractionDigits:2,
        maximumFractionDigits:2
      });
    }
  }

  // Only the document preview/totals are re-rendered.
  render();
}
function toggleMultiDay(cId, idx) {
  var c = cats.find(function(x){ return x.id===cId; });
  if (!c || !c.items[idx]) return;
  var it = c.items[idx];
  it.multiDay = !it.multiDay;
  if (!it.days || it.days < 1) it.days = 1;
  if (it.multiDay && (!isFinite(parseFloat(it.multiDayPrice)) || parseFloat(it.multiDayPrice) < 0)) {
    it.multiDayPrice = 0;
  }
  renderCats();
  render();
}
function toggleManualTotal(cId, idx) {
  var c = cats.find(function(x){ return x.id===cId; });
  if (!c || !c.items[idx]) return;
  var it = c.items[idx];
  var autoTotal = itemTotal({qty:it.qty,unit:it.unit,days:it.days,multiDay:it.multiDay,multiDayPrice:it.multiDayPrice,manualTotal:false});
  it.manualTotal = !it.manualTotal;
  if (it.manualTotal) it.total = autoTotal;
  renderCats(); render();
}
function updateColLabel(field, val) {
  colLabels[field] = val;
  render();
}
function cycleCatColor(id) {
  var c = cats.find(function(x){ return x.id===id; });
  if (!c) return;
  c.color = CAT_COLORS[(CAT_COLORS.indexOf(c.color)+1) % CAT_COLORS.length];
  renderCats(); render();
}

function renderCats() {
  var sym = (gv('currency')||'Rs. ').trim();
  var html = '';
  for (var ci = 0; ci < cats.length; ci++) {
    var c = cats[ci];
    var catType = c.type || 'standard';
    var isRemoved = (catType === 'removed');
    var isAdditional = (catType === 'additional');
    var blockClass = 'cat-block' + (isRemoved ? ' cat-block-removed' : (isAdditional ? ' cat-block-additional' : ''));
    var rows = '';
    for (var ii = 0; ii < c.items.length; ii++) {
      var it = c.items[ii];
      var rawTotal = itemTotal(it);
      var lineTotal = (isRemoved ? '− ' : '') + rawTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
      var descOn = it.showDesc !== false;
      var tagOn = it.showTag !== false;
      var unitOn = it.showUnit !== false;
      var qtyOn = it.showQty !== false;
      var manualOn = !!it.manualTotal;
      var multiDayOn = !!it.multiDay;
      var days = (parseFloat(it.days)||1);
      var totalOn = it.showTotal !== false;
      rows += '<tr class="item-row" data-cid="' + c.id + '" data-idx="' + ii + '" ondragover="onItemDragOver(event)" ondragleave="onItemDragLeave(event)" ondrop="onItemDrop(event,' + c.id + ',' + ii + ')">' +
        '<td class="item-cell item-cell-desc" data-label="' + esc(colLabels.desc) + '"><div style="display:flex;align-items:center;gap:3px">' +
          '<div class="item-drag-handle" draggable="true" ondragstart="onItemDragStart(event,' + c.id + ',' + ii + ')" ondragend="onItemDragEnd(event)" title="Drag to reorder item"><i class="ti ti-grip-vertical" style="font-size:12px"></i></div>' +
          '<input style="flex:1' + (isRemoved ? ';text-decoration:line-through;color:#991b1b' : '') + '" value="' + esc(it.desc) + '" placeholder="Description" oninput="updateItem(' + c.id + ',' + ii + ',\'desc\',this.value)">' +
          '<button class="btn-icon" style="padding:3px;color:' + (descOn?'var(--accent)':'var(--text2)') + '" title="' + (descOn?'Description shown on invoice — click to hide':'Description hidden on invoice — click to show') + '" onclick="toggleItemVis(' + c.id + ',' + ii + ',\'showDesc\')"><i class="ti ti-' + (descOn?'eye':'eye-off') + '" style="font-size:13px"></i></button>' +
        '</div></td>' +
        '<td class="item-cell item-cell-tag" data-label="' + esc(colLabels.tag) + '"><div style="display:flex;align-items:center;gap:3px">' +
          '<input style="flex:1" value="' + esc(it.tag) + '" placeholder="Tag" oninput="updateItem(' + c.id + ',' + ii + ',\'tag\',this.value)">' +
          '<button class="btn-icon" style="padding:3px;color:' + (tagOn?'var(--accent)':'var(--text2)') + '" title="' + (tagOn?'Tag shown on invoice — click to hide':'Tag hidden on invoice — click to show') + '" onclick="toggleItemVis(' + c.id + ',' + ii + ',\'showTag\')"><i class="ti ti-' + (tagOn?'eye':'eye-off') + '" style="font-size:13px"></i></button>' +
        '</div></td>' +
        '<td class="item-cell item-cell-qty" data-label="' + esc(colLabels.qty) + '"><div style="display:flex;align-items:center;gap:3px">' +
          '<input style="flex:1" type="number" inputmode="decimal" aria-label="' + esc(colLabels.qty) + '" value="' + esc(it.qty) + '" step="any" oninput="updateItem(' + c.id + ',' + ii + ',\'qty\',this.value)">' +
          '<button class="btn-icon" style="padding:3px;color:' + (qtyOn?'var(--accent)':'var(--text2)') + '" title="' + (qtyOn?'Quantity shown on invoice — click to hide':'Quantity hidden on invoice — click to show') + '" onclick="toggleItemVis(' + c.id + ',' + ii + ',\'showQty\')"><i class="ti ti-' + (qtyOn?'eye':'eye-off') + '" style="font-size:13px"></i></button>' +
        '</div></td>' +
        '<td class="item-cell item-cell-unit" data-label="' + esc(colLabels.unit + ' (' + sym + ')') + '"><div style="display:flex;align-items:center;gap:3px">' +
          '<input style="flex:1" type="number" inputmode="decimal" aria-label="' + esc(colLabels.unit) + '" value="' + esc(it.unit) + '" step="any" oninput="updateItem(' + c.id + ',' + ii + ',\'unit\',this.value)">' +
          '<button class="btn-icon" style="padding:3px;color:' + (unitOn?'var(--accent)':'var(--text2)') + '" title="' + (unitOn?'Unit price shown on invoice — click to hide':'Unit price hidden on invoice — click to show') + '" onclick="toggleItemVis(' + c.id + ',' + ii + ',\'showUnit\')"><i class="ti ti-' + (unitOn?'eye':'eye-off') + '" style="font-size:13px"></i></button>' +
        '</div></td>' +
        '<td class="item-cell item-cell-total" data-label="' + esc(colLabels.total) + '"><div style="display:flex;align-items:center;gap:3px">' +
          (manualOn
            ? '<input style="flex:1;text-align:right;color:' + (isRemoved?'#dc2626':'var(--accent)') + ';font-weight:600" type="number" value="' + (it.total||0) + '" step="any" oninput="updateItem(' + c.id + ',' + ii + ',\'total\',this.value)">'
            : '<span class="item-line-total" style="flex:1;text-align:right;font-size:12px;font-weight:600;color:' + (isRemoved?'#dc2626':(isAdditional?'#16a34a':'var(--text2)')) + '">' + lineTotal + '</span>') +
          '<button class="btn-icon" style="padding:3px;color:' + (totalOn?'var(--accent)':'var(--text2)') + '" title="' + (totalOn?'Amount shown on invoice — click to hide (e.g. lump-sum category budgets)':'Amount hidden on invoice — click to show') + '" onclick="toggleItemVis(' + c.id + ',' + ii + ',\'showTotal\')"><i class="ti ti-' + (totalOn?'eye':'eye-off') + '" style="font-size:13px"></i></button>' +
          '<button class="btn-icon" style="padding:3px;color:' + (manualOn?'var(--accent)':'var(--text2)') + '" title="' + (manualOn?'Total is manually set — click to auto-calculate again':'Total auto-calculated — click to edit manually') + '" onclick="toggleManualTotal(' + c.id + ',' + ii + ')"><i class="ti ti-' + (manualOn?'lock':'pencil') + '" style="font-size:12px"></i></button>' +
          '<button class="btn btn-sm multi-day-toggle" style="padding:3px 6px;font-size:10px;line-height:1.2;color:' + (multiDayOn?'var(--accent)':'var(--text2)') + ';border-color:' + (multiDayOn?'var(--accent)':'var(--border2)') + '" title="' + (multiDayOn?'Multi-day pricing ON — click to use normal one-day pricing':'Enable multi-day pricing for this item') + '" onclick="toggleMultiDay(' + c.id + ',' + ii + ')"><i class="ti ti-calendar-time" style="font-size:12px"></i> ' + (multiDayOn ? (days + ' day' + (days==1?'':'s')) : '+ Days') + '</button>' +
        '</div></td>' +
        '<td class="item-cell item-cell-actions" style="text-align:center"><div style="display:flex;align-items:center;justify-content:center;gap:2px">' +
          '<div class="item-reorder-group">' +
            '<button type="button" class="btn-icon" style="padding:1px 3px;font-size:11px" title="Move item to Top" onclick="moveItem(' + c.id + ',' + ii + ',\'top\')"' + (ii===0?' disabled style="opacity:0.25;cursor:not-allowed"':'') + '><i class="ti ti-chevrons-up"></i></button>' +
            '<button type="button" class="btn-icon" style="padding:1px 3px;font-size:11px" title="Move item Up" onclick="moveItem(' + c.id + ',' + ii + ',-1)"' + (ii===0?' disabled style="opacity:0.25;cursor:not-allowed"':'') + '><i class="ti ti-chevron-up"></i></button>' +
            '<button type="button" class="btn-icon" style="padding:1px 3px;font-size:11px" title="Move item Down" onclick="moveItem(' + c.id + ',' + ii + ',1)"' + (ii===c.items.length-1?' disabled style="opacity:0.25;cursor:not-allowed"':'') + '><i class="ti ti-chevron-down"></i></button>' +
            '<button type="button" class="btn-icon" style="padding:1px 3px;font-size:11px" title="Move item to Bottom" onclick="moveItem(' + c.id + ',' + ii + ',\'bottom\')"' + (ii===c.items.length-1?' disabled style="opacity:0.25;cursor:not-allowed"':'') + '><i class="ti ti-chevrons-down"></i></button>' +
          '</div>' +
          (isRemoved
            ? '<button class="btn-icon" title="Restore item back to standard category" onclick="restoreRemovedItem(' + c.id + ',' + ii + ')" style="color:#16a34a"><i class="ti ti-arrow-back-up" style="font-size:13px"></i></button>'
            : '<button class="btn-icon" title="Move item to Removed Items (Deduction)" onclick="moveItemToRemoved(' + c.id + ',' + ii + ')" style="color:#dc2626"><i class="ti ti-arrow-down-right" style="font-size:13px"></i></button>') +
          '<button class="btn-icon" title="Delete item completely" onclick="removeItem(' + c.id + ',' + ii + ')"><i class="ti ti-x" style="font-size:12px"></i></button>' +
        '</div></td>' +
        '</tr>' +
        (multiDayOn ? '<tr class="multi-day-row" data-cid="' + c.id + '" data-idx="' + ii + '"><td colspan="6" style="padding:8px 10px;background:var(--surface2);border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;flex-wrap:wrap;font-size:11.5px;color:var(--text2)"><i class="ti ti-calendar-time" style="color:var(--accent)"></i><strong style="color:var(--text)">Multi-day</strong><span>Days</span><input type="number" min="1" step="1" value="' + days + '" oninput="updateItem(' + c.id + ',' + ii + ',\'days\',this.value)" style="width:65px;padding:4px 7px;border:1px solid var(--border2);border-radius:6px;background:var(--surface);color:var(--text);text-align:right"><span>Manual total</span><div style="display:flex;align-items:center;gap:4px"><span style="font-weight:600">' + sym + '</span><input type="number" step="any" value="' + (parseFloat(it.multiDayPrice)||0) + '" oninput="updateItem(' + c.id + ',' + ii + ',\'multiDayPrice\',this.value)" style="width:120px;padding:4px 7px;border:1px solid var(--border2);border-radius:6px;background:var(--surface);color:var(--text);text-align:right"></div><span class="multi-day-price-display" style="font-weight:700;color:var(--text);display:none">' + sym + ' ' + lineTotal + '</span></div></td></tr>' : '');
    }
    var discBtnColor = c.discEnabled ? '#16a34a' : 'var(--text2)';
    var discBtnIcon = c.discEnabled ? 'ti-discount-check' : 'ti-discount';
    var discBtnLabel = c.discEnabled ? 'Disc: ON' : 'Add discount';
    var discRowDisp = c.discEnabled ? 'flex' : 'none';

    var discModeOpts = '<option value="pct"' + (c.discMode==='pct'?' selected':'') + '>%</option>' +
                      '<option value="amt"' + (c.discMode==='amt'?' selected':'') + '>Fixed</option>';

    var budgetBtnColor = c.budgetEnabled ? accent : 'var(--text2)';
    var budgetBtnIcon = c.budgetEnabled ? 'ti-wallet' : 'ti-wallet';
    var budgetBtnLabel = c.budgetEnabled ? 'Budget: ON' : 'Set category budget';
    var budgetRowDisp = c.budgetEnabled ? 'flex' : 'none';

    html += '<div class="' + blockClass + '" data-cid="' + c.id + '" ondragover="onCatDragOver(event)" ondragleave="onCatDragLeave(event)" ondrop="onCatDrop(event,' + ci + ')">' +
      '<div class="cat-header">' +
        '<div class="cat-drag-handle" draggable="true" ondragstart="onCatDragStart(event,' + ci + ')" ondragend="onCatDragEnd(event)" title="Drag to reorder category"><i class="ti ti-grip-vertical"></i></div>' +
        '<div class="cat-color-dot" style="background:' + esc(c.color) + '" onclick="cycleCatColor(' + c.id + ')" title="Change colour"></div>' +
        '<input class="cat-name-input" value="' + esc(c.name) + '" oninput="updateCatField(' + c.id + ',\'name\',this.value)" placeholder="Category name">' +
        '<select class="cat-type-select" onchange="updateCatType(' + c.id + ',this.value)" title="Category role in quotation">' +
          '<option value="standard"' + (catType==='standard'?' selected':'') + '>Standard</option>' +
          '<option value="additional"' + (catType==='additional'?' selected':'') + ' style="color:#16a34a;font-weight:700">+ Additional (+)</option>' +
          '<option value="removed"' + (catType==='removed'?' selected':'') + ' style="color:#dc2626;font-weight:700">&minus; Removed (&minus;)</option>' +
        '</select>' +
        '<div class="cat-reorder-group">' +
          '<button type="button" class="btn-icon" style="padding:2px 4px;font-size:12px" title="Move category to Top" onclick="moveCategory(' + ci + ',\'top\')"' + (ci===0?' disabled style="opacity:0.25;cursor:not-allowed"':'') + '><i class="ti ti-chevrons-up"></i></button>' +
          '<button type="button" class="btn-icon" style="padding:2px 4px;font-size:12px" title="Move category Up" onclick="moveCategory(' + ci + ',-1)"' + (ci===0?' disabled style="opacity:0.25;cursor:not-allowed"':'') + '><i class="ti ti-chevron-up"></i></button>' +
          '<button type="button" class="btn-icon" style="padding:2px 4px;font-size:12px" title="Move category Down" onclick="moveCategory(' + ci + ',1)"' + (ci===cats.length-1?' disabled style="opacity:0.25;cursor:not-allowed"':'') + '><i class="ti ti-chevron-down"></i></button>' +
          '<button type="button" class="btn-icon" style="padding:2px 4px;font-size:12px" title="Move category to Bottom" onclick="moveCategory(' + ci + ',\'bottom\')"' + (ci===cats.length-1?' disabled style="opacity:0.25;cursor:not-allowed"':'') + '><i class="ti ti-chevrons-down"></i></button>' +
        '</div>' +
        '<button class="btn-icon" onclick="removeCategory(' + c.id + ')" title="Delete category"><i class="ti ti-trash"></i></button>' +
      '</div>' +
      '<div class="cat-table-wrap">' +
      '<table class="item-table"><thead><tr>' +
        '<th><input value="' + esc(colLabels.desc) + '" oninput="updateColLabel(\'desc\',this.value)" style="width:100%;border:none;background:transparent;font:inherit;font-weight:600;font-size:10.5px;color:var(--text2);text-transform:uppercase;padding:1px 2px"></th>' +
        '<th><input value="' + esc(colLabels.tag) + '" oninput="updateColLabel(\'tag\',this.value)" style="width:100%;border:none;background:transparent;font:inherit;font-weight:600;font-size:10.5px;color:var(--text2);text-transform:uppercase;padding:1px 2px"></th>' +
        '<th><input value="' + esc(colLabels.qty) + '" oninput="updateColLabel(\'qty\',this.value)" style="width:100%;border:none;background:transparent;font:inherit;font-weight:600;font-size:10.5px;color:var(--text2);text-transform:uppercase;padding:1px 2px"></th>' +
        '<th><input value="' + esc(colLabels.unit) + '" oninput="updateColLabel(\'unit\',this.value)" style="width:100%;border:none;background:transparent;font:inherit;font-weight:600;font-size:10.5px;color:var(--text2);text-transform:uppercase;padding:1px 2px" title="Displayed as &quot;' + esc(colLabels.unit) + ' (' + sym + ')&quot; on the document">&nbsp;(' + sym + ')</th>' +
        '<th><input value="' + esc(colLabels.total) + '" oninput="updateColLabel(\'total\',this.value)" style="width:100%;border:none;background:transparent;font:inherit;font-weight:600;font-size:10.5px;color:var(--text2);text-transform:uppercase;padding:1px 2px"></th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div>' +
      '<div class="add-item-row">' +
        '<button class="btn btn-sm btn-ghost" onclick="addItem(' + c.id + ')"><i class="ti ti-plus"></i> Add item</button>' +
        '<div style="display:flex;gap:4px">' +
        '<button class="btn btn-sm" style="color:' + discBtnColor + ';font-size:11px" onclick="toggleCatDisc(' + c.id + ')">' +
          '<i class="ti ' + discBtnIcon + '" style="font-size:13px"></i> ' + discBtnLabel +
        '</button>' +
        '<button class="btn btn-sm" style="color:' + budgetBtnColor + ';font-size:11px" onclick="toggleCatBudget(' + c.id + ')" title="Show one lump-sum budget for this category instead of the summed item amounts">' +
          '<i class="ti ' + budgetBtnIcon + '" style="font-size:13px"></i> ' + budgetBtnLabel +
        '</button>' +
        '</div>' +
      '</div>' +
      '<div id="catDiscRow_' + c.id + '" class="cat-disc-row" style="display:' + discRowDisp + '">' +
        '<label>Label</label>' +
        '<input style="flex:1;min-width:70px;padding:3px 7px;border:1px solid var(--border2);border-radius:4px;font-size:12px;background:var(--surface);color:var(--text)" value="' + esc(c.discLabel) + '" oninput="updateCatField(' + c.id + ',\'discLabel\',this.value)">' +
        '<select onchange="updateCatField(' + c.id + ',\'discMode\',this.value);render()">' + discModeOpts + '</select>' +
        '<input type="number" value="' + c.discVal + '" step="any" placeholder="0" oninput="updateCatField(' + c.id + ',\'discVal\',this.value)">' +
      '</div>' +
      '<div id="catBudgetRow_' + c.id + '" class="cat-disc-row" style="display:' + budgetRowDisp + '">' +
        '<label>Label</label>' +
        '<input style="flex:1;min-width:70px;padding:3px 7px;border:1px solid var(--border2);border-radius:4px;font-size:12px;background:var(--surface);color:var(--text)" value="' + esc(c.budgetLabel) + '" oninput="updateCatField(' + c.id + ',\'budgetLabel\',this.value)">' +
        '<label>Amount</label>' +
        '<input type="number" value="' + c.budgetVal + '" step="any" placeholder="0" oninput="updateCatField(' + c.id + ',\'budgetVal\',this.value)" style="width:110px;text-align:right">' +
      '</div>' +
      '<div class="cat-note-editor" style="border-top:1px solid var(--border);border-bottom:0">' +
        '<textarea placeholder="Category note / description (optional)" oninput="updateCategoryNote(' + c.id + ',this.value)">' + esc(c.note||'') + '</textarea>' +
      '</div>' +
      '</div>';
  }
  var addCategoryBar = '<div class="cat-add-actions" style="display:flex;gap:6px;margin:10px 0 16px;flex-wrap:wrap;padding:8px 10px;background:var(--surface2);border:1px dashed var(--border2);border-radius:10px;align-items:center">' +
    '<span style="font-size:11.5px;font-weight:600;color:var(--text2);margin-right:2px"><i class="ti ti-plus"></i> Add:</span>' +
    '<button type="button" class="btn btn-sm btn-ghost" onclick="addCategory(null)"><i class="ti ti-folder-plus"></i> Category</button>' +
    '<button type="button" class="btn btn-sm btn-ghost" style="color:#16a34a;font-weight:600" onclick="addAdditionalCategory()"><i class="ti ti-circle-plus"></i> Additional Category</button>' +
    '<button type="button" class="btn btn-sm btn-ghost" style="color:#dc2626;font-weight:600" onclick="addRemovedCategory()"><i class="ti ti-circle-minus"></i> Removed Category</button>' +
  '</div>';
  document.getElementById('categories').innerHTML = html + addCategoryBar;
}

// ── TOTALS ──
function calcTotals() {
  var standardSub = 0;
  var additionalSub = 0;
  var removedSub = 0;

  var catData = cats.map(function(c) {
    var rawSub = c.items.reduce(function(a,it){ return a+itemTotal(it); }, 0);
    var catDisc = 0, catDiscLabel = '';
    if (c.discEnabled && !c.budgetEnabled) {
      var dv = parseFloat(c.discVal)||0;
      catDisc = (c.discMode==='pct') ? (rawSub*dv/100) : dv;
      catDiscLabel = (c.discMode==='pct') ? (c.discLabel+' ('+dv+'%)') : c.discLabel;
    }
    var budgetVal = parseFloat(c.budgetVal)||0;
    var sub = c.budgetEnabled ? budgetVal : (rawSub - catDisc);
    var catType = c.type || 'standard';

    if (catType === 'removed') {
      removedSub += sub;
    } else if (catType === 'additional') {
      additionalSub += sub;
    } else {
      standardSub += sub;
    }

    return {
      name: c.name,
      type: catType,
      color: c.color,
      note: c.note||'',
      rawSub: rawSub,
      catDisc: catDisc,
      catDiscLabel: catDiscLabel,
      sub: sub,
      items: c.items,
      discEnabled: c.discEnabled && !c.budgetEnabled,
      budgetEnabled: c.budgetEnabled,
      budgetVal: budgetVal,
      budgetLabel: c.budgetLabel
    };
  });

  var subtotal = standardSub + additionalSub - removedSub;
  if (subtotal < 0) subtotal = 0;

  var discAmt = 0, discLabel = '';
  if (gc('discEnabled')) {
    var dv = parseFloat(gv('discVal'))||0;
    discAmt = (gv('discMode')==='pct') ? (subtotal*dv/100) : dv;
    discLabel = (gv('discMode')==='pct') ? ((gv('discLabel')||'Discount')+' ('+dv+'%)') : (gv('discLabel')||'Discount');
  }

  var afterDisc = subtotal - discAmt;
  if (afterDisc < 0) afterDisc = 0;

  var taxAmt = 0, taxLabel = '';
  if (gc('taxEnabled')) {
    var tv = parseFloat(gv('taxVal'))||0;
    taxAmt = (gv('taxMode')==='pct') ? (afterDisc*tv/100) : tv;
    taxLabel = (gv('taxMode')==='pct') ? ((gv('taxLabel')||'VAT')+' ('+tv+'%)') : (gv('taxLabel')||'VAT');
  }

  return {
    catData: catData,
    standardSub: standardSub,
    additionalSub: additionalSub,
    removedSub: removedSub,
    hasRevisions: (additionalSub > 0 || removedSub > 0),
    subtotal: subtotal,
    discAmt: discAmt,
    discLabel: discLabel,
    taxAmt: taxAmt,
    taxLabel: taxLabel,
    grand: afterDisc + taxAmt
  };
}

// ── RENDER ──
// render() is called on every keystroke. Rebuilding + re-paginating the whole
// preview each time made typing laggy on long quotations, so calls are now
// coalesced into a single paint per animation frame. Anything that needs the
// preview DOM to be current *right now* (exports, print) calls flushRender().
var _renderPending = false, _renderFrame = null;
function render() {
  markDocDirty();
  if (_renderPending) return;
  _renderPending = true;
  var run = function() { _renderFrame = null; if (_renderPending) renderNow(); };
  _renderFrame = (typeof requestAnimationFrame === 'function' && document.visibilityState !== 'hidden')
    ? requestAnimationFrame(run) : setTimeout(run, 0);
}
function flushRender() {
  if (_renderPending) {
    if (_renderFrame !== null) { try { cancelAnimationFrame(_renderFrame); } catch (e) {} clearTimeout(_renderFrame); _renderFrame = null; }
    renderNow();
  }
}
function renderNow() {
  _renderPending = false;
  var t = calcTotals();
  var sz = parseInt(gv('logoSize')||108);

  var logoHtml = LOGO_DATA
    ? '<img src="' + LOGO_DATA + '" style="height:' + sz + 'px;max-width:' + (sz*2) + 'px;object-fit:contain;flex-shrink:0;margin-right:.9rem" alt="Logo">'
    : '';

  var docType = gv('docType');
  var DOC_META = {
    'Quotation':        {solid:false, dateLabel:'Valid until', amountLabel:'Quotation total'},
    'Invoice':           {solid:true,  dateLabel:'Due',         amountLabel:'Amount due'},
    'Proforma Invoice':  {solid:true,  dateLabel:'Due',         amountLabel:'Amount due'},
    'Purchase Order':    {solid:false, dateLabel:'Delivery by', amountLabel:'Order total'},
    'Credit Note':       {solid:false, dateLabel:'Issued',      amountLabel:'Credit total'}
  };
  var meta = DOC_META[docType] || DOC_META['Quotation'];
  var dueWrap = document.getElementById('dueDateFieldWrap');
  if (dueWrap) dueWrap.style.display = (docType === 'Credit Note') ? 'none' : '';

  var showEv = gc('showEvent') && (gv('eventName')||'').trim();
  var activeEventDates = getActiveEventDates();
  var evLoc = (gv('eventLocation')||'').trim();

  var eventParts = [];
  if (showEv) {
    eventParts.push('<span class="event-detail-name">' + esc(gv('eventName')) + '</span>');
    if (activeEventDates.length) {
      eventParts.push(
        '<span class="event-detail-dates">' +
        activeEventDates.map(function(d){ return esc(d); }).join(' / ') +
        '</span>'
      );
    }
    if (evLoc) {
      eventParts.push('<span class="event-detail-location">' + esc(evLoc) + '</span>');
    }
  }

  var eventBanner = showEv
    ? '<div class="doc-event-banner">' +
        eventParts.map(function(part, i){
          return (i ? '<span class="event-detail-sep">&bull;</span>' : '') + part;
        }).join('') +
      '</div>'
    : '';

  // Build category sections
  var showUnitCol = gc('showUnitCol');
  var showAmountDue = gc('showAmountDue');
  var docTextScale = (parseFloat(gv('docTextSize'))||100) / 100;
  var showCatHeadingTotal = gc('showCatHeadingTotal');
  var showCatSubtotal = gc('showCatSubtotal');
  // Wide enough that amounts like "Rs. 1,250,000.00" no longer wrap onto two lines.
  var gridCols = showUnitCol ? 'minmax(0,1fr) 44px 108px 116px' : 'minmax(0,1fr) 44px 116px';
  var headSpans = showUnitCol
    ? '<span>' + esc(colLabels.desc) + '</span><span>' + esc(colLabels.qty) + '</span><span>' + esc(colLabels.unit) + '</span><span>' + esc(colLabels.total) + '</span>'
    : '<span>' + esc(colLabels.desc) + '</span><span>' + esc(colLabels.qty) + '</span><span>' + esc(colLabels.total) + '</span>';
  var catSections = '';
  for (var ci = 0; ci < t.catData.length; ci++) {
    var c = t.catData[ci];
    var catType = c.type || 'standard';
    var isRemoved = (catType === 'removed');
    var isAdditional = (catType === 'additional');
    var bg = isRemoved ? 'rgba(220, 38, 38, 0.08)' : (isAdditional ? 'rgba(22, 163, 74, 0.08)' : rgba(c.color, 0.09));
    var headingColor = isRemoved ? '#dc2626' : (isAdditional ? '#16a34a' : esc(c.color));
    var itemRows = '';
    for (var ii = 0; ii < c.items.length; ii++) {
      var it = c.items[ii];
      var total = itemTotal(it);
      var descOn = it.showDesc !== false;
      var tagOn = it.showTag !== false;
      var unitOn = it.showUnit !== false;
      var qtyOn = it.showQty !== false;
      var totalOn = it.showTotal !== false;
      var tagChipBg = isRemoved ? 'rgba(220,38,38,0.1)' : (isAdditional ? 'rgba(22,163,74,0.1)' : rgba(c.color,0.1));
      var tagChip = tagOn ? ('<span class="item-tag" style="background:' + tagChipBg + ';color:' + headingColor + '">' + esc(it.tag) + '</span>') : '';
      var dayNote = it.multiDay ? '<span style="display:block;font-size:9.5px;color:#999;margin-top:2px">' + (parseFloat(it.days)||1) + ' day' + ((parseFloat(it.days)||1)===1?'':'s') + '</span>' : '';
      var descStyle = isRemoved ? 'text-decoration:line-through;color:#991b1b;opacity:0.85' : '';
      var descSpan = descOn
        ? '<span' + (descStyle ? ' style="' + descStyle + '"' : '') + '>' + esc(it.desc||'—') + tagChip + dayNote + '</span>'
        : '<span>' + tagChip + dayNote + '</span>';
      var unitPrefix = isRemoved ? '&minus; ' : (isAdditional ? '+ ' : '');
      var totalPrefix = isRemoved ? '&minus; ' : (isAdditional ? '+ ' : '');
      var totalColor = isRemoved ? '#dc2626' : (isAdditional ? '#16a34a' : '#111');
      var unitSpan = showUnitCol ? ('<span>' + (unitOn ? (unitPrefix + fmt(it.unit) + (it.multiDay ? '<span style="display:block;font-size:9px;color:#aaa">/ day</span>' : '')) : '') + '</span>') : '';
      itemRows += '<div class="doc-item' + (isRemoved ? ' doc-item-removed' : '') + '" style="grid-template-columns:' + gridCols + '">' +
        descSpan +
        '<span>' + (qtyOn ? it.qty : '') + '</span>' +
        unitSpan +
        '<span style="font-weight:600;color:' + totalColor + '">' + (totalOn ? (totalPrefix + fmt(total)) : '') + '</span>' +
        '</div>';
    }
    var discLine = (c.discEnabled && c.catDisc > 0)
      ? '<div class="cat-disc-line"><span>' + esc(c.catDiscLabel) + '</span><span>&minus; ' + fmt(c.catDisc) + '</span></div>'
      : '';
    var subLabel = (c.discEnabled && c.catDisc > 0) ? 'Net total' : 'Subtotal';
    var headingAmt = c.budgetEnabled ? c.budgetVal : c.sub;
    var headingAmtFormatted = (isRemoved ? '&minus; ' : (isAdditional ? '+ ' : '')) + fmt(headingAmt);
    var subtotalLine;
    if (!showCatSubtotal) {
      subtotalLine = '';
    } else if (c.budgetEnabled) {
      var colCount = showUnitCol ? 4 : 3;
      var budgetSpans = '';
      for (var bi = 0; bi < colCount; bi++) {
        if (bi === colCount - 2) budgetSpans += '<span style="font-weight:700;color:' + headingColor + '">' + esc(c.budgetLabel||'Category Budget') + '</span>';
        else if (bi === colCount - 1) budgetSpans += '<span style="font-weight:700;color:' + headingColor + '">' + (isRemoved ? '&minus; ' : (isAdditional ? '+ ' : '')) + fmt(c.budgetVal) + '</span>';
        else budgetSpans += '<span></span>';
      }
      subtotalLine = '<div class="doc-item" style="grid-template-columns:' + gridCols + ';border-top:1px dashed #eee;margin-top:2px;padding-top:6px">' + budgetSpans + '</div>';
    } else if (isRemoved) {
      subtotalLine = '<div class="cat-subtotal" style="color:#dc2626"><span>' + esc(c.name) + ' (Deduction)</span><span style="color:#dc2626">&minus; ' + fmt(c.sub) + '</span></div>';
    } else if (isAdditional) {
      subtotalLine = '<div class="cat-subtotal" style="color:#16a34a"><span>' + esc(c.name) + ' Subtotal</span><span style="color:#16a34a">+ ' + fmt(c.sub) + '</span></div>';
    } else {
      subtotalLine = '<div class="cat-subtotal"><span>' + esc(c.name) + ' ' + subLabel + '</span><span style="color:' + esc(c.color) + '">' + fmt(c.sub) + '</span></div>';
    }

    var typeBadge = '';
    if (isRemoved) {
      typeBadge = '<span style="margin-left:7px;font-size:9px;background:#fee2e2;color:#dc2626;border:1px solid #fecaca;padding:1px 6px;border-radius:4px;font-weight:700;letter-spacing:normal">&minus; DEDUCTION / REMOVED</span>';
    } else if (isAdditional) {
      typeBadge = '<span style="margin-left:7px;font-size:9px;background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;padding:1px 6px;border-radius:4px;font-weight:700;letter-spacing:normal">+ ADDITIONAL</span>';
    }

    catSections +=
      '<div class="cat-sec' + (isRemoved ? ' cat-sec-removed' : '') + '">' +
      '<div class="cat-heading" style="background:' + bg + ';color:' + headingColor + '">' +
        '<span>' + esc(c.name) + typeBadge + '</span>' + (showCatHeadingTotal ? '<span>' + headingAmtFormatted + '</span>' : '') +
      '</div>' +
      '<div class="items-head" style="grid-template-columns:' + gridCols + '">' + headSpans + '</div>' +
      itemRows + discLine +
      subtotalLine +
      (c.note ? '<div class="cat-note-preview" style="padding-top:7px;border-top:1px solid #f2f2f2;margin-top:5px">' + esc(c.note).replace(/\n/g,'<br>') + '</div>' : '') +
      '</div>';
  }

  // Summary lines
  var sumLines = '';
  if (t.hasRevisions) {
    if (t.standardSub > 0) {
      sumLines += '<div class="sum-line"><span>Base Scope / Package</span><span>' + fmt(t.standardSub) + '</span></div>';
    }
    if (t.additionalSub > 0) {
      sumLines += '<div class="sum-line" style="color:#16a34a;font-weight:600"><span>Additional Items (+)</span><span>+ ' + fmt(t.additionalSub) + '</span></div>';
    }
    if (t.removedSub > 0) {
      sumLines += '<div class="sum-line" style="color:#dc2626;font-weight:600"><span>Removed Items / Deductions (&minus;)</span><span>&minus; ' + fmt(t.removedSub) + '</span></div>';
    }
    sumLines += '<div class="sum-line" style="font-weight:700;border-top:1px solid #eee;margin-top:2px;padding-top:4px"><span>Revised Subtotal</span><span>' + fmt(t.subtotal) + '</span></div>';
  } else {
    sumLines += '<div class="sum-line"><span>Subtotal</span><span>' + fmt(t.subtotal) + '</span></div>';
  }
  if (gc('discEnabled') && t.discAmt > 0)
    sumLines += '<div class="sum-line" style="color:#16a34a"><span>' + esc(t.discLabel) + '</span><span>&minus; ' + fmt(t.discAmt) + '</span></div>';
  if (gc('taxEnabled') && t.taxAmt > 0)
    sumLines += '<div class="sum-line"><span>' + esc(t.taxLabel) + '</span><span>+ ' + fmt(t.taxAmt) + '</span></div>';

  // Signatures
  var signers = [];
  if (gc('sign1')) signers.push({name:'Sasindu Methsukha', role: gv('sign1role')||'Director', img: SIG_SASINDU});
  if (gc('sign2')) signers.push({name:'Sampath Priyantha', role: gv('sign2role')||'Authorized Signatory', img: SIG_SAMPATH});
  var sigScale = (parseFloat(gv('sigSize'))||125) / 100;
  var showApprovedLabel = gc('showApprovedLabel');
  var sigHtml = '';
  if (signers.length > 0) {
    var sigBlocks = '';
    for (var si = 0; si < signers.length; si++) {
      var sg = signers[si];
      var sigMark = sg.img
        ? '<img src="' + sg.img + '" alt="Signature" class="sig-img" style="height:' + (2.6*sigScale).toFixed(2) + 'rem">'
        : '<div class="sig-line" style="margin:' + (2.2*sigScale).toFixed(2) + 'rem 0 .5rem"></div>';
      var approvedLabel = showApprovedLabel
        ? '<div class="sig-approved-label" style="font-size:' + (10*sigScale).toFixed(1) + 'px">Approved by</div>'
        : '';
      sigBlocks += '<div class="sig-block">' +
        approvedLabel +
        sigMark +
        '<div class="sig-name" style="font-size:' + (13*sigScale).toFixed(1) + 'px">' + esc(sg.name) + '</div>' +
        '<div class="sig-role" style="font-size:' + (11*sigScale).toFixed(1) + 'px">' + esc(sg.role) + '</div>' +
        '</div>';
    }
    sigHtml = '<div class="doc-signatures' + (signers.length === 1 ? ' single' : '') + '">' + sigBlocks + '</div>';
  }

  var notes = (gv('docNotes')||'').trim()
    ? '<div class="doc-notes-area"><strong>Terms &amp; Conditions</strong><br>' + esc(gv('docNotes')) + '</div>'
    : '';

  var paymentHtml = '';
  if (gc('showPayment')) {
    var pBank = (gv('payBank')||'').trim();
    var pAccName = (gv('payAccName')||'').trim();
    var pAccNo = (gv('payAccNo')||'').trim();
    if (pBank || pAccName || pAccNo) {
      paymentHtml = '<div class="doc-notes-area"><strong>Payment Information</strong><br>' +
        (pBank ? 'Bank: ' + esc(pBank) + '<br>' : '') +
        (pAccName ? 'Account Name: ' + esc(pAccName) + '<br>' : '') +
        (pAccNo ? 'Account No: ' + esc(pAccNo) : '') +
        '</div>';
    }
  }

  var addrLine = (gv('clientAddr')||'').replace(/\n/g,' &middot; ');
  var coAddrLine = (gv('coAddr')||'').replace(/\n/g,' &middot; ');

  document.getElementById('preview').innerHTML =
    '<div class="preview-doc' + (docType === 'Quotation' ? ' doc-minimal' : '') + '" id="invoiceDoc" style="zoom:' + docTextScale + '">' +
    '<div class="doc-accent-bar" style="background:' + accent + '"></div>' +
    '<div class="doc-header-wrap">' +
      '<div style="display:flex;align-items:center">' +
        logoHtml +
        '<div>' +
          '<div class="doc-company-name" style="color:' + accent + '">' + esc(gv('coName')) + '</div>' +
          '<div class="doc-company-sub">' + esc(gv('coEmail')) + ' &nbsp;&middot;&nbsp; ' + esc(gv('coPhone')) + '</div>' +
          (gv('coInstagram').trim() || gv('coWebsite').trim() ?
            '<div class="doc-company-contact">' + [gv('coInstagram').trim(), gv('coWebsite').trim()].filter(Boolean).map(esc).join(' &nbsp;&middot;&nbsp; ') + '</div>' : '') +
          '<div class="doc-company-contact">' + coAddrLine + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="doc-meta-block">' +
        '<div class="doc-type-title" style="color:' + accent + '">' + esc(docType||'Quotation') + '</div>' +
        '<div class="doc-num-line" style="color:#333;margin-top:4px">#' + esc(gv('docNum')) + '</div>' +
        '<div class="doc-meta-dates">' +
          '<div class="dd-item">Issued<strong>' + esc(gv('issueDate')) + '</strong></div>' +
          (docType === 'Invoice' ? '' : '<div class="dd-item">' + esc(meta.dateLabel) + '<strong>' + esc(gv('dueDate')) + '</strong></div>') +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="doc-dates-strip">' +
      '<div class="dd-item">Issued<strong>' + esc(gv('issueDate')) + '</strong></div>' +
      (docType === 'Invoice' ? '' : '<div class="dd-item">' + esc(meta.dateLabel) + '<strong>' + esc(gv('dueDate')) + '</strong></div>') +
    '</div>' +
    '<div class="doc-divider"></div>' +
    eventBanner +
    '<div class="doc-parties">' +
      '<div>' +
        '<div class="party-label">Bill to</div>' +
        '<div class="party-name" style="white-space:pre-line">' + esc(gv('clientName')) + '</div>' +
        '<div class="party-line">' + esc(gv('clientContact')) + '</div>' +
        '<div class="party-line">' + esc(gv('clientEmail')) + '</div>' +
        '<div class="party-line">' + addrLine + '</div>' +
      '</div>' +
      '<div style="text-align:right">' +
        (showAmountDue
          ? '<div class="party-label">' + esc(meta.amountLabel) + '</div>' +
            '<div style="font-size:20px;font-weight:800;color:' + accent + '">' + fmt(t.grand) + '</div>' +
            '<div class="party-line">Grand total</div>'
          : '') +
      '</div>' +
    '</div>' +
    '<div class="doc-items-wrap">' + catSections + '</div>' +
    '<div class="doc-summary-wrap"><div class="summary-inner">' +
      sumLines +
      '<div class="sum-total" style="background:' + accent + '"><span>Grand Total</span><span>' + fmt(t.grand) + '</span></div>' +
    '</div></div>' +
    notes + paymentHtml + sigHtml +
    '</div>';
  paginateDoc();
  applyPageGap();
  maybeAutoSyncSupabase();
}

// Sets the visual gap between page sheets in the preview from the
// "Page gap" slider. Doesn't need a full re-render since it's just a
// CSS gap on the already-built page stack.
function applyPageGap() {
  var doc = document.getElementById('invoiceDoc');
  if (!doc) return;
  var gap = parseFloat(gv('pageGap'));
  doc.style.gap = (isNaN(gap) ? 32 : gap) + 'px';
}

// ── PAGINATION (Word-style page breaks) ──
// A4 content-area aspect ratio (height/width) after a 10mm margin on all
// sides: (297-20) / (210-20) = 277/190. We derive the pixel page height
// from the doc's actual rendered width so this works at any zoom level
// or screen size.
var PAGE_CONTENT_ASPECT = 277 / 190;

function paginateDoc() {
  var doc = document.getElementById('invoiceDoc');
  if (!doc) return;

  // Flatten top-level children into atomic blocks. Category sections are
  // unwrapped out of .doc-items-wrap so a page break can fall *between*
  // categories, but no block is ever split internally.
  var rawChildren = Array.prototype.slice.call(doc.children);
  var blocks = [];
  rawChildren.forEach(function(child) {
    if (child.classList.contains('doc-items-wrap')) {
      Array.prototype.slice.call(child.children).forEach(function(cat) { blocks.push(cat); });
    } else {
      blocks.push(child);
    }
  });
  if (blocks.length === 0) return;

  // Measure each block's true height (including its own margins) while
  // it's still laid out normally, before we touch the DOM structure.
  var heights = blocks.map(function(b) {
    var r = b.getBoundingClientRect();
    var cs = getComputedStyle(b);
    return r.height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  });

  var pageW = doc.getBoundingClientRect().width || doc.offsetWidth;
  if (!pageW) return;
  var pageH = pageW * PAGE_CONTENT_ASPECT;
  // getBoundingClientRect() is in zoomed (rendered) pixels when the "Text
  // size" slider applies CSS zoom, but min-height is in CSS pixels. Convert,
  // otherwise pages at 85% / 120% came out shorter / taller than A4.
  var cssScale = (doc.offsetWidth && pageW) ? (pageW / doc.offsetWidth) : 1;

  // Greedy-pack blocks into pages; never split a block across pages.
  var pages = [[]];
  var used = 0;
  for (var i = 0; i < blocks.length; i++) {
    var h = heights[i];
    var cur = pages[pages.length - 1];
    if (cur.length > 0 && used + h > pageH) {
      pages.push([]);
      cur = pages[pages.length - 1];
      used = 0;
    }
    cur.push(blocks[i]);
    used += h;
  }

  // Rebuild #invoiceDoc as a stack of .doc-page sheets. Consecutive
  // category blocks are re-wrapped in a fresh .doc-items-wrap so they
  // keep their original padding.
  var frag = document.createDocumentFragment();
  pages.forEach(function(pageBlocks, idx) {
    var pageEl = document.createElement('div');
    pageEl.className = 'doc-page';
    pageEl.style.minHeight = (pageH / cssScale) + 'px';
    var j = 0;
    while (j < pageBlocks.length) {
      var b = pageBlocks[j];
      if (b.classList.contains('cat-sec')) {
        var wrap = document.createElement('div');
        wrap.className = 'doc-items-wrap';
        while (j < pageBlocks.length && pageBlocks[j].classList.contains('cat-sec')) {
          wrap.appendChild(pageBlocks[j]);
          j++;
        }
        pageEl.appendChild(wrap);
      } else {
        pageEl.appendChild(b);
        j++;
      }
    }
    if (pages.length > 1) {
      var num = document.createElement('div');
      num.className = 'doc-page-number';
      num.textContent = 'Page ' + (idx + 1) + ' of ' + pages.length;
      pageEl.appendChild(num);
    }
    frag.appendChild(pageEl);
  });
  doc.innerHTML = '';
  doc.appendChild(frag);
  rebalanceDocPages(doc);
}

// The greedy pass above measures blocks on their own, so it cannot see the
// padding each page's .doc-items-wrap adds or the page-number footer. Pages
// came out taller than A4 (and were squashed when exported to PDF). This pass
// measures the real pages and pushes the last block forward until each fits.
function rebalanceDocPages(doc) {
  var pageSel = ':scope > .doc-page';
  function pageList() { return Array.prototype.slice.call(doc.querySelectorAll(pageSel)); }
  function maxH(pg) { var r = pg.getBoundingClientRect(); return r.width * PAGE_CONTENT_ASPECT; }
  function contentH(pg) {
    // Rendered height of the content, ignoring min-height.
    var mh = pg.style.minHeight; pg.style.minHeight = '0px';
    var h = pg.getBoundingClientRect().height;
    pg.style.minHeight = mh;
    return h;
  }
  function blocksOf(pg) {
    var out = [];
    Array.prototype.slice.call(pg.children).forEach(function(ch) {
      if (ch.classList.contains('doc-page-number')) return;
      if (ch.classList.contains('doc-items-wrap')) Array.prototype.slice.call(ch.children).forEach(function(c) { out.push(c); });
      else out.push(ch);
    });
    return out;
  }
  function newPage(likePage) {
    var pg = document.createElement('div');
    pg.className = 'doc-page';
    pg.style.minHeight = likePage.style.minHeight;
    return pg;
  }
  function moveToNext(block, from, to) {
    var parent = block.parentNode;
    var num = to.querySelector(':scope > .doc-page-number');
    if (block.classList.contains('cat-sec')) {
      var first = to.firstElementChild;
      var wrap = (first && first.classList.contains('doc-items-wrap')) ? first : null;
      if (!wrap) { wrap = document.createElement('div'); wrap.className = 'doc-items-wrap'; to.insertBefore(wrap, to.firstChild); }
      wrap.insertBefore(block, wrap.firstChild);
      if (parent && parent !== from && !parent.children.length) parent.parentNode.removeChild(parent);
    } else {
      to.insertBefore(block, to.firstChild === num ? num : to.firstChild);
    }
  }
  function renumber() {
    var pages = pageList();
    pages.forEach(function(pg, idx) {
      var num = pg.querySelector(':scope > .doc-page-number');
      if (pages.length > 1) {
        if (!num) { num = document.createElement('div'); num.className = 'doc-page-number'; pg.appendChild(num); }
        num.textContent = 'Page ' + (idx + 1) + ' of ' + pages.length;
      } else if (num) {
        num.parentNode.removeChild(num);
      }
    });
  }
  var pages = pageList();
  if (!pages.length || !pages[0].getBoundingClientRect().width) return;
  renumber();
  for (var i = 0, safety = 0; i < pages.length && safety < 200; i++) {
    var pg = pages[i];
    while (contentH(pg) > maxH(pg) + 0.5 && safety++ < 200) {
      var bl = blocksOf(pg);
      if (bl.length <= 1) break; // a single block taller than a page cannot be split
      if (!pages[i + 1]) { var np = newPage(pg); doc.appendChild(np); pages.push(np); renumber(); }
      moveToNext(bl[bl.length - 1], pg, pages[i + 1]);
    }
  }
  renumber();
}

// ── TEMPLATES ──
function renderTemplates() {
  var html = '';
  for (var i = 0; i < TEMPLATES.length; i++) {
    var t = TEMPLATES[i];
    html += '<div class="tpl-card" id="tpl-' + i + '" onclick="loadTemplate(' + i + ')">' +
      '<div class="tpl-accent" style="background:' + accent + '"></div>' +
      '<div style="display:flex;gap:7px;align-items:center;margin-bottom:3px">' +
        '<i class="ti ' + t.icon + '" style="font-size:17px;color:' + accent + '"></i>' +
        '<strong style="font-size:13px">' + esc(t.name) + '</strong>' +
      '</div>' +
      '<p style="font-size:11px;color:var(--text2)">' + esc(t.desc) + '</p>' +
      '</div>';
  }
  document.getElementById('tplGrid').innerHTML = html;
}
function loadTemplate(i) {
  document.querySelectorAll('.tpl-card').forEach(function(c){ c.classList.remove('selected'); });
  var el = document.getElementById('tpl-'+i); if (el) el.classList.add('selected');
  cats = []; catId = 0;
  for (var ci = 0; ci < TEMPLATES[i].cats.length; ci++) {
    addCategory(TEMPLATES[i].cats[ci]);
  }
  showPane('editor');
}

// ── EXPORTS ──
// The document is already split into discrete .doc-page sheets by
// paginateDoc() (see above), each sized to a full A4 page with no block
// ever cut across a boundary. Exporting is therefore just: capture each
// sheet as its own image and drop it onto its own PDF page — no more
// slicing one giant image (which is what previously caused duplicated /
// torn text right at page seams).
//
// Each capture happens on a fully isolated off-screen CLONE (never the
// live, visible element) so nothing about the on-screen preview is
// touched, and any CSS quirks from the surrounding app UI can't bleed
// into the snapshot.
function captureInvoiceCanvas(el, zoomFactor, lockWidth, ancestorClassName) {
  zoomFactor = zoomFactor || 1;
  return new Promise(function(resolve, reject) {
    var clone = el.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.zoom = zoomFactor;
    clone.style.margin = '0';
    // Force every captured page to the same pre-zoom width. Without this,
    // a page with little content (e.g. just terms & signatures) shrink-
    // wraps narrower than a full page once detached from its normal
    // container, then gets stretched back out to fill the PDF page width -
    // which is what was making its text look small/off vs. other pages.
    if (lockWidth) clone.style.width = (lockWidth / zoomFactor) + 'px';

    var wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '0';
    wrapper.style.left = '-99999px';
    wrapper.style.background = '#ffffff';
    wrapper.style.pointerEvents = 'none';
    // Design variants (e.g. the "modern minimal" Quotation look) are keyed
    // off a class on the outer #invoiceDoc wrapper (.doc-minimal), not on
    // the individual .doc-page itself. Since PDF export captures one page
    // at a time after detaching it from that outer wrapper, it needs that
    // same class reapplied here or it silently falls back to the default
    // template - which is what was happening.
    if (ancestorClassName) wrapper.className = ancestorClassName;
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    function cleanup() { document.body.removeChild(wrapper); }

    // Give the clone a frame to lay itself out (and fonts/images to be
    // ready) before html2canvas walks it.
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
      .then(function() {
        return new Promise(function(r) { setTimeout(r, 50); });
      })
      .then(function() {
        return html2canvas(clone, {scale: 2, useCORS: true, backgroundColor: '#ffffff'});
      })
      .then(function(canvas) { cleanup(); resolve(canvas); })
      .catch(function(e) { cleanup(); reject(e); });
  });
}
function exportLibsReady(needPdf) {
  if (typeof window.html2canvas !== 'function' || (needPdf && !(window.jspdf && window.jspdf.jsPDF))) {
    showToast('The export library has not loaded yet. Check your internet connection and try again in a moment.', 'error');
    return false;
  }
  return true;
}
function downloadPNG() {
  if (!exportLibsReady(false)) return;
  flushRender();
  var el = document.getElementById('invoiceDoc');
  if (!el) { alert('Preview not ready.'); return; }
  var zoomFactor = parseFloat(el.style.zoom) || 1;
  // offsetWidth x own zoom == on-screen width, but is unaffected by any zoom
  // on ancestors (the phone preview is scaled to fit the screen).
  var lockWidth = (el.offsetWidth * zoomFactor) || el.getBoundingClientRect().width;
  captureInvoiceCanvas(el, zoomFactor, lockWidth, el.className).then(function(canvas) {
    var a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = (gv('docNum')||'invoice') + '.png';
    a.click();
  }).catch(function(e){ alert('PNG failed: ' + e.message); });
}
function downloadPDF() {
  if (!exportLibsReady(true)) return;
  flushRender();
  var doc = document.getElementById('invoiceDoc');
  if (!doc) { alert('Preview not ready.'); return; }
  var zoomFactor = parseFloat(doc.style.zoom) || 1;
  // Measure the canonical page width once, from the live document (whose
  // width is governed by its container, not by how much content is on any
  // one page), and lock every captured page to that same width.
  var lockWidth = (doc.offsetWidth * zoomFactor) || doc.getBoundingClientRect().width;
  var docClassName = doc.className;
  var pageEls = Array.prototype.slice.call(doc.querySelectorAll(':scope > .doc-page'));
  if (pageEls.length === 0) pageEls = [doc];

  var btn = document.getElementById('pdfBtn');
  btn.innerHTML = '<i class="ti ti-loader"></i> Generating...'; btn.disabled = true;

  var pdf = new window.jspdf.jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
  var pageW = pdf.internal.pageSize.getWidth();
  var pageH = pdf.internal.pageSize.getHeight();
  var marginX = 10, marginY = 10;
  var imgW = pageW - marginX * 2;
  var maxImgH = pageH - marginY * 2;

  var chain = Promise.resolve();
  pageEls.forEach(function(pageEl, idx) {
    chain = chain.then(function() {
      return captureInvoiceCanvas(pageEl, zoomFactor, lockWidth, docClassName).then(function(canvas) {
        if (idx > 0) pdf.addPage();
        var imgData = canvas.toDataURL('image/jpeg', 0.95);
        // Keep the aspect ratio. A page taller than A4 (one category longer
        // than a page) used to be squashed vertically; now it is scaled down.
        var w = imgW, h = (canvas.height / canvas.width) * imgW;
        if (h > maxImgH) { w = w * (maxImgH / h); h = maxImgH; }
        pdf.addImage(imgData, 'JPEG', marginX + (imgW - w) / 2, marginY, w, h);
      });
    });
  });

  chain.then(function() {
    pdf.save((gv('docNum')||'invoice') + '.pdf');
    btn.innerHTML = '<i class="ti ti-file-type-pdf"></i> PDF'; btn.disabled = false;
  }).catch(function(e) {
    alert('PDF failed: ' + e.message);
    btn.innerHTML = '<i class="ti ti-file-type-pdf"></i> PDF'; btn.disabled = false;
  });
}
function testGS() {
  var url = gv('gsUrl'), st = document.getElementById('gsStatus');
  if (!url) { st.innerHTML = '<span class="pill pill-warn">Enter URL first</span>'; return; }
  st.innerHTML = '<span class="pill pill-info">Testing...</span>';
  fetch(url, {method:'GET'}).then(function(){ st.innerHTML = '<span class="pill pill-success"><i class="ti ti-check"></i> Connected</span>'; })
    .catch(function(){ st.innerHTML = '<span class="pill pill-warn"><i class="ti ti-alert-triangle"></i> Could not reach URL</span>'; });
}
function pushToSheets() {
  var url = gv('gsUrl'); if (!url) { alert('Enter your Apps Script URL.'); return; }
  var t = calcTotals(), today = localISODate(), rows = [];
  cats.forEach(function(c){ c.items.forEach(function(it){
    var isRem = (c.type === 'removed');
    var itTot = isRem ? -itemTotal(it) : itemTotal(it);
    var itUnit = isRem ? -Math.abs(it.unit||0) : (it.unit||0);
    rows.push([gv('docNum'),gv('docType'),gvFlat('clientName'),gv('eventName'),c.name,it.desc,it.tag,it.qty||1,itUnit,itTot,today,gv('currency').trim()]);
  }); });
  rows.push([gv('docNum'),gv('docType'),gvFlat('clientName'),gv('eventName'),'—','GRAND TOTAL','—','','',t.grand,today,gv('currency').trim()]);
  fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
    sheet: gv('gsSheet')||'Invoices',
    headers: ['Doc #','Type','Client','Event','Category','Item','Tag','Qty','Unit Price','Line Total','Date','Currency'],
    rows: rows
  })}).then(function(r){ return r.json(); }).then(function(){ alert('Pushed ' + rows.length + ' rows to Sheets!'); })
    .catch(function(){ alert('Push failed. Check URL and permissions.'); });
}
function copyScript() {
  navigator.clipboard.writeText(document.getElementById('appsScriptCode').textContent)
    .then(function(){ alert('Script copied!'); }).catch(function(){ alert('Please copy manually.'); });
}

// ── SUPABASE CLOUD SYNC (full app state, cross-device) ──
var sbSyncTimer = null;
function loadSupabaseCreds() {
  try {
    document.getElementById('sbUrl').value = localStorage.getItem('invoicegen:sb:url') || '';
    document.getElementById('sbKey').value = localStorage.getItem('invoicegen:sb:key') || '';
    document.getElementById('sbAutoSync').checked = localStorage.getItem('invoicegen:sb:auto') === '1';
    var ws = localStorage.getItem('invoicegen:sb:workspace');
    if (!ws) { ws = generateWorkspaceIdValue(); localStorage.setItem('invoicegen:sb:workspace', ws); }
    document.getElementById('sbWorkspace').value = ws;
  } catch (e) {}
  updateSbBanner();
}
function saveSupabaseCreds() {
  try {
    localStorage.setItem('invoicegen:sb:url', gv('sbUrl').trim());
    localStorage.setItem('invoicegen:sb:key', gv('sbKey').trim());
    localStorage.setItem('invoicegen:sb:workspace', gv('sbWorkspace').trim());
    localStorage.setItem('invoicegen:sb:auto', gc('sbAutoSync') ? '1' : '0');
  } catch (e) {}
  updateSbBanner();
}
function sbConfigured() {
  return !!(gv('sbUrl').trim() && gv('sbKey').trim() && gv('sbWorkspace').trim());
}
function sbBase() { return gv('sbUrl').trim().replace(/\/+$/, ''); }
function updateSbBanner() {
  var banner = document.getElementById('sbConnBanner');
  var infoText = document.getElementById('historyInfoText');
  if (banner) {
    banner.innerHTML = sbConfigured()
      ? '<span class="pill pill-success"><i class="ti ti-cloud-check"></i> Cloud storage active &mdash; Save and History use Supabase</span>'
      : '<span class="pill pill-warn"><i class="ti ti-cloud-off"></i> Not connected &mdash; fill in the fields below, run the SQL once, then Test</span>';
  }
  if (infoText) {
    infoText.innerHTML = sbConfigured()
      ? 'Saved documents are stored in Supabase under Workspace ID <strong>' + esc(gv('sbWorkspace').trim()) + '</strong> &mdash; available on any browser or device using that same ID.'
      : 'Connect Supabase in the <strong>Cloud</strong> tab to save documents there &mdash; then every saved invoice is available on any browser or device using the same Workspace ID.';
  }
}
// Cryptographically secure random string (Math.random() is predictable and
// must not be used for workspace IDs or passwords).
function secureRandomString(len, chars) {
  var out = '';
  var buf = new Uint32Array(len);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buf);
  else for (var j = 0; j < len; j++) buf[j] = Math.floor(Math.random() * 4294967296);
  for (var i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}
function generateWorkspaceIdValue() {
  return secureRandomString(20, 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789');
}
function generateWorkspaceId() {
  if (gv('sbWorkspace').trim() && !confirm('This creates a brand new empty workspace. Any other device using the old ID will no longer sync with this one. Continue?')) return;
  document.getElementById('sbWorkspace').value = generateWorkspaceIdValue();
  saveSupabaseCreds();
  refreshHistoryList();
}
function copyWorkspaceId() {
  navigator.clipboard.writeText(gv('sbWorkspace')).then(function(){ alert('Workspace ID copied!'); }).catch(function(){ alert('Please copy manually.'); });
}
function copySupabaseSql() {
  navigator.clipboard.writeText(document.getElementById('supabaseSqlCode').textContent)
    .then(function(){ alert('SQL copied!'); }).catch(function(){ alert('Please copy manually.'); });
}
function sbProjectRef() {
  var m = gv('sbUrl').trim().match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m ? m[1] : '';
}
function openSqlEditor() {
  var ref = sbProjectRef();
  if (!ref) { alert('Enter your Supabase Project URL above first (it looks like https://xxxxxxxx.supabase.co).'); return; }
  navigator.clipboard.writeText(document.getElementById('supabaseSqlCode').textContent).catch(function(){});
  window.open('https://supabase.com/dashboard/project/' + ref + '/sql/new', '_blank');
  alert('The setup SQL has been copied to your clipboard. Paste it into the SQL Editor tab that just opened, then click "Run". Come back here and hit Test once it finishes.');
}
// Recognizes Supabase's "table not found in schema cache" error (PGRST205),
// which means the setup SQL hasn't been run in this project yet.
function isMissingTableError(raw) {
  try { return JSON.parse(raw).code === 'PGRST205'; } catch (e) { return false; }
}
function isPermissionDeniedError(raw) {
  try {
    var p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return p.code === '42501' || (p.message && p.message.toLowerCase().indexOf('permission denied') !== -1);
  } catch (e) {
    var str = String(raw || '');
    return str.indexOf('42501') !== -1 || str.toLowerCase().indexOf('permission denied') !== -1;
  }
}
function offerCreateTables() {
  showPane('cloud');
  if (confirm('Your Supabase project is missing the required table(s) or permissions. Open the SQL Editor now to run the setup script? The script will be copied to your clipboard automatically — just paste it there and click Run.')) {
    openSqlEditor();
  }
}
function sbHeaders(key, extra) {
  var bearer = (typeof PROFILE_SESSION!=='undefined' && PROFILE_SESSION && PROFILE_SESSION.access_token) ? PROFILE_SESSION.access_token : key;
  var h = { 'apikey': key, 'Authorization': 'Bearer ' + bearer, 'Content-Type': 'application/json' };
  if (extra) for (var k in extra) h[k] = extra[k];
  return h;
}
function testSupabase() {
  var url = gv('sbUrl').trim(), key = gv('sbKey').trim(), st = document.getElementById('sbStatus');
  if (!url || !key) { st.innerHTML = '<span class="pill pill-warn">Enter URL and key first</span>'; return; }
  st.innerHTML = '<span class="pill pill-info">Testing...</span>';
  fetch(url.replace(/\/+$/,'') + '/rest/v1/invoice_documents?select=id&limit=1', { headers: sbHeaders(key) })
    .then(function(r){ if (!r.ok) return r.text().then(function(t){ throw new Error(t || ('HTTP ' + r.status)); }); return r.json(); })
    .then(function(){ st.innerHTML = '<span class="pill pill-success"><i class="ti ti-check"></i> Connected</span>'; updateSbBanner(); refreshHistoryList(); })
    .catch(function(e){
      if (isMissingTableError(e.message)) {
        st.innerHTML = '<span class="pill pill-warn"><i class="ti ti-alert-triangle"></i> Tables not created yet</span>';
        offerCreateTables();
      } else if (isPermissionDeniedError(e.message)) {
        st.innerHTML = '<span class="pill pill-warn"><i class="ti ti-alert-triangle"></i> Permission denied on tables</span>';
        offerCreateTables();
      } else {
        st.innerHTML = '<span class="pill pill-warn"><i class="ti ti-alert-triangle"></i> Could not connect (' + escMsg(e) + ')</span>';
      }
    });
}
function buildFullAppState() {
  // Settings-only snapshot (company details, theme, current draft). Saved invoices
  // themselves live in the invoice_documents table, not in this blob.
  var seqCounters = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('invoicegen:seq:') === 0) seqCounters[k] = localStorage.getItem(k);
    }
  } catch (e) {}
  return {
    form: collectFormState(),
    eventDates: eventDates.slice(),
    cats: cats,
    catId: catId,
    colLabels: colLabels,
    accent: accent,
    dark: dark,
    logoData: LOGO_DATA,
    seqCounters: seqCounters,
    savedAt: new Date().toISOString()
  };
}
// Restores a saved document/app snapshot into the editor. Shared by
// Load (history), Pull from cloud and draft recovery.
function applyDocSnapshot(state) {
  if (!state) return;
  applyFormState(state.form || {});
  eventDates = Array.isArray(state.eventDates) && state.eventDates.length
    ? state.eventDates.slice()
    : ((state.form && state.form.eventDate) ? [state.form.eventDate] : ['']);
  renderEventDates();
  docNumManual = true;
  document.getElementById('logoSizeVal').textContent = (gv('logoSize')||108) + 'px';
  document.getElementById('docTextSizeVal').textContent = (gv('docTextSize')||100) + '%';
  document.getElementById('sigSizeVal').textContent = (gv('sigSize')||125) + '%';
  document.getElementById('pageGapVal').textContent = (gv('pageGap')||32) + 'px';
  toggleField('eventFieldWrap', gc('showEvent'));
  toggleField('discFields', gc('discEnabled'));
  toggleField('taxFields', gc('taxEnabled'));
  toggleField('paymentFieldWrap', gc('showPayment'));
  cats = state.cats || [];
  catId = state.catId || 0;
  colLabels = state.colLabels || colLabels;
  accent = state.accent || accent;
  dark = !!state.dark;
  LOGO_DATA = state.logoData || '';
  document.documentElement.setAttribute('data-theme', dark?'dark':'');
  document.getElementById('themeBtn').innerHTML = dark ? '<i class="ti ti-sun"></i> Light' : '<i class="ti ti-moon"></i> Dark';
  if (LOGO_DATA) {
    document.getElementById('logoThumb').src = LOGO_DATA;
    document.getElementById('logoPreviewWrap').style.display = '';
    document.getElementById('logoUploadArea').style.display = 'none';
  } else {
    document.getElementById('logoPreviewWrap').style.display = 'none';
    document.getElementById('logoUploadArea').style.display = '';
  }
  renderCats();
  render();
}
function applyFullAppState(state) {
  if (!state) return;
  try {
    Object.keys(state.seqCounters || {}).forEach(function(k){ localStorage.setItem(k, state.seqCounters[k]); });
  } catch (e) {}
  applyDocSnapshot(state);
}
function pushToSupabase() {
  var url = gv('sbUrl').trim(), key = gv('sbKey').trim(), ws = gv('sbWorkspace').trim(), st = document.getElementById('sbStatus');
  if (!url || !key || !ws) { st.innerHTML = '<span class="pill pill-warn">Fill in URL, key, and Workspace ID first</span>'; return; }
  st.innerHTML = '<span class="pill pill-info">Pushing...</span>';
  var payload = { workspace_id: ws, data: buildFullAppState(), updated_at: new Date().toISOString() };
  fetch(url.replace(/\/+$/,'') + '/rest/v1/invoice_app_state', {
    method: 'POST',
    headers: sbHeaders(key, { 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify(payload)
  }).then(function(r){ if (!r.ok) return r.text().then(function(t){ throw new Error(t || ('HTTP ' + r.status)); }); return r; })
    .then(function(){ st.innerHTML = '<span class="pill pill-success"><i class="ti ti-check"></i> Synced to cloud</span>'; })
    .catch(function(e){ st.innerHTML = '<span class="pill pill-warn"><i class="ti ti-alert-triangle"></i> Push failed: ' + escMsg(e) + '</span>'; });
}
function pullFromSupabase() {
  var url = gv('sbUrl').trim(), key = gv('sbKey').trim(), ws = gv('sbWorkspace').trim(), st = document.getElementById('sbStatus');
  if (!url || !key || !ws) { st.innerHTML = '<span class="pill pill-warn">Fill in URL, key, and Workspace ID first</span>'; return; }
  if (!confirm('This will replace everything currently in the editor with the version stored in the cloud. Continue?')) return;
  st.innerHTML = '<span class="pill pill-info">Pulling...</span>';
  fetch(url.replace(/\/+$/,'') + '/rest/v1/invoice_app_state?workspace_id=eq.' + encodeURIComponent(ws) + '&select=data', { headers: sbHeaders(key) })
    .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(rows){
      if (!rows.length) { st.innerHTML = '<span class="pill pill-warn">No data saved yet for this Workspace ID</span>'; return; }
      applyFullAppState(rows[0].data);
      st.innerHTML = '<span class="pill pill-success"><i class="ti ti-check"></i> Loaded from cloud</span>';
      refreshHistoryList();
    })
    .catch(function(e){ st.innerHTML = '<span class="pill pill-warn"><i class="ti ti-alert-triangle"></i> Pull failed: ' + escMsg(e) + '</span>'; });
}
function maybeAutoSyncSupabase() {
  if (!gc('sbAutoSync')) return;
  if (!gv('sbUrl').trim() || !gv('sbKey').trim() || !gv('sbWorkspace').trim()) return;
  clearTimeout(sbSyncTimer);
  sbSyncTimer = setTimeout(pushToSupabase, 2500);
}
function exportCSV() {
  var t = calcTotals();
  var rows = [['Doc #','Type','Client','Event','Category','Item','Tag','Qty','Unit Price','Line Total','Currency']];
  cats.forEach(function(c){ c.items.forEach(function(it){
    var isRem = (c.type === 'removed');
    var itTot = isRem ? -itemTotal(it) : itemTotal(it);
    var itUnit = isRem ? -Math.abs(it.unit||0) : (it.unit||0);
    rows.push([gv('docNum'),gv('docType'),gvFlat('clientName'),gv('eventName'),c.name,it.desc,it.tag,it.qty||1,itUnit,itTot,gv('currency').trim()]);
  }); });
  rows.push(['','','','','','','SUBTOTAL','','',t.subtotal,'']);
  if (gc('discEnabled') && t.discAmt > 0) rows.push(['','','','','','',t.discLabel,'','','-'+t.discAmt.toFixed(2),'']);
  if (gc('taxEnabled') && t.taxAmt > 0) rows.push(['','','','','','',t.taxLabel,'','',t.taxAmt.toFixed(2),'']);
  rows.push(['','','','','','','GRAND TOTAL','','',t.grand.toFixed(2),gv('currency').trim()]);
  var csv = rows.map(function(r){ return r.map(function(v){ return '"'+String(v||'').replace(/"/g,'""')+'"'; }).join(','); }).join('\n');
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = (gv('docNum')||'invoice') + '.csv';
  a.click();
}

// ── SAVED DOCUMENT HISTORY (private storage) ──
function collectFormState() {
  var state = {};
  document.querySelectorAll('#pane-editor input[id], #pane-editor select[id], #pane-editor textarea[id]').forEach(function(el){
    if (el.type === 'file') return;
    state[el.id] = (el.type === 'checkbox') ? el.checked : el.value;
  });
  return state;
}
function applyFormState(state) {
  Object.keys(state).forEach(function(id){
    var el = document.getElementById(id);
    if (!el || el.type === 'file') return;
    if (el.type === 'checkbox') { el.checked = !!state[id]; }
    else { el.value = state[id]; }
  });
}
function buildDocSnapshot() {
  return {
    form: collectFormState(),
    eventDates: eventDates.slice(),
    cats: cats,
    catId: catId,
    colLabels: colLabels,
    accent: accent,
    dark: dark,
    logoData: LOGO_DATA,
    savedAt: new Date().toISOString()
  };
}
async function saveCurrentDoc() {
  var btn = document.getElementById('saveDocBtn');
  var originalHtml = btn.innerHTML;
  if (!sbConfigured()) {
    if (confirm('Supabase isn\'t connected yet, so this document can\'t be saved to the cloud. Open the Cloud tab to set it up now?')) {
      showPane('cloud');
    }
    return;
  }
  btn.innerHTML = '<i class="ti ti-loader"></i> Saving...';
  btn.disabled = true;
  try {
    var t = calcTotals();
    var snapshot = buildDocSnapshot();
    var payload = {
      workspace_id: gv('sbWorkspace').trim(),
      doc_number: gv('docNum') || '(no number)',
      doc_type: gv('docType') || 'Quotation',
      client_name: gvFlat('clientName') || '(no client)',
      event_name: gv('eventName') || '',
      issue_date: gv('issueDate') || null,
      due_date: gv('dueDate') || null,
      grand_total: t.grand,
      currency: gv('currency').trim() || 'Rs. ',
      snapshot: snapshot,
      updated_at: new Date().toISOString()
    };
    // Upsert: a document with the same doc_number in this workspace gets overwritten
    // instead of duplicated, so re-saving an already-saved invoice just updates it.
    var r = await fetch(sbBase() + '/rest/v1/invoice_documents?on_conflict=workspace_id,doc_number', {
      method: 'POST',
      headers: sbHeaders(gv('sbKey').trim(), { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(payload)
    });
    if (!r.ok) { var errText = await r.text(); throw new Error(errText || ('HTTP ' + r.status)); }
    commitDocNumber(payload.doc_type, payload.doc_number);
    markDocClean();
    showToast(payload.doc_type + ' ' + payload.doc_number + ' saved to cloud', 'success');
    btn.innerHTML = '<i class="ti ti-check"></i> Saved to cloud';
    setTimeout(function(){ btn.innerHTML = originalHtml; btn.disabled = false; }, 1500);
    refreshHistoryList();
  } catch (e) {
    console.error('Save failed', e);
    btn.innerHTML = originalHtml;
    btn.disabled = false;
    if (isMissingTableError(e.message) || isPermissionDeniedError(e.message)) {
      offerCreateTables();
    } else {
      alert('Could not save this document to Supabase: ' + e.message);
    }
  }
}


var currentHistoryEntries = [];

function renderHistoryCards(rows) {
  var wrap = document.getElementById('historyList');
  if (!wrap) return;
  if (!rows || !rows.length) {
    wrap.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text2);font-size:12.5px"><i class="ti ti-receipt-off" style="font-size:24px;display:block;margin-bottom:6px;color:var(--text3)"></i>No saved documents found in this workspace yet.</div>';
    return;
  }
  var html = '';
  rows.forEach(function(item) {
    var dt = item.updated_at ? new Date(item.updated_at).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }) : '';
    var total = (typeof item.grand_total === 'number') ? (item.currency || 'Rs. ') + item.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    var docType = item.doc_type || 'Quotation';
    var typeClass = docType.toLowerCase() === 'invoice' ? 'pill-success' : 'pill-info';
    html += '<div class="signer-card" style="margin-bottom:.65rem;padding:.75rem;border:1px solid var(--border);border-radius:10px;background:var(--surface);display:flex;flex-direction:column;gap:6px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<span class="pill ' + typeClass + '" style="font-size:10.5px;padding:2px 7px;font-weight:600">' + esc(docType) + '</span>' +
          '<strong style="font-size:13px;color:var(--text)">' + esc(item.doc_number || '(No Number)') + '</strong>' +
        '</div>' +
        '<span style="font-size:11px;color:var(--text3)">' + esc(dt) + '</span>' +
      '</div>' +
      '<div style="font-size:12.5px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(item.client_name || '(No client)') + '</div>' +
      (item.event_name ? '<div style="font-size:11.5px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><i class="ti ti-calendar-event" style="margin-right:3px"></i>' + esc(item.event_name) + '</div>' : '') +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;padding-top:6px;border-top:1px dashed var(--border)">' +
        '<div style="font-size:13px;font-weight:700;color:var(--accent)">' + esc(total) + '</div>' +
        '<div style="display:flex;gap:4px">' +
          '<button class="btn btn-sm btn-primary" style="padding:3px 10px;font-size:11.5px" onclick="loadSavedDoc(\'' + esc(item.id) + '\')"><i class="ti ti-folder-open"></i> Load</button>' +
          '<button class="btn btn-sm btn-ghost" style="padding:3px 8px;font-size:11.5px;color:var(--accent)" title="Load as revision (keeps original intact)" onclick="loadDocAsRevision(\'' + esc(item.id) + '\')"><i class="ti ti-git-branch"></i> Revise</button>' +
          '<button class="btn btn-sm btn-danger" style="padding:3px 7px;font-size:11.5px" title="Delete" onclick="deleteSavedDoc(\'' + esc(item.id) + '\')"><i class="ti ti-trash"></i></button>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  wrap.innerHTML = html;
}

async function refreshHistoryList() {
  var wrap = document.getElementById('historyList');
  if (!wrap) return;
  if (!sbConfigured()) {
    currentHistoryEntries = [];
    wrap.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text2);font-size:12.5px">Connect Supabase in the <strong>Cloud</strong> tab to see saved documents here.</div>';
    return;
  }
  wrap.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text2);font-size:12.5px">Loading saved documents...</div>';
  try {
    var ws = gv('sbWorkspace').trim();
    var url = sbBase() + '/rest/v1/invoice_documents?workspace_id=eq.' + encodeURIComponent(ws) +
      '&select=id,doc_number,doc_type,client_name,event_name,grand_total,currency,updated_at&order=updated_at.desc&limit=200';
    var r = await fetch(url, { headers: sbHeaders(gv('sbKey').trim()) });
    if (!r.ok) { var errText = await r.text(); throw new Error(errText || ('HTTP ' + r.status)); }
    var rows = await r.json();
    currentHistoryEntries = rows || [];
    renderHistoryCards(currentHistoryEntries);
    filterHistoryList();
  } catch (e) {
    console.error('Failed to load history', e);
    currentHistoryEntries = [];
    if (isMissingTableError(e.message) || isPermissionDeniedError(e.message)) {
      wrap.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text2);font-size:12.5px">Supabase tables or permissions not set up yet. <button class="btn btn-sm btn-primary" style="margin-top:.5rem" onclick="offerCreateTables()"><i class="ti ti-database"></i> Fix Tables / Permissions</button></div>';
    } else {
      wrap.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text2);font-size:12.5px">Could not load saved documents (' + esc(e.message) + ').</div>';
    }
  }
}

function filterHistoryList() {
  var wrap = document.getElementById('historyList');
  if (!wrap) return;
  var input = document.getElementById('historySearchInput');
  var clearBtn = document.getElementById('historySearchClear');
  var query = input ? (input.value || '').trim().toLowerCase() : '';

  if (clearBtn) {
    clearBtn.style.display = query ? 'block' : 'none';
  }

  var cards = wrap.querySelectorAll('.signer-card');
  var emptyMsg = wrap.querySelector('.history-empty-search-msg');

  if (!cards || !cards.length) {
    if (emptyMsg && !query) emptyMsg.remove();
    return;
  }

  var visibleCount = 0;
  cards.forEach(function(card) {
    var text = (card.textContent || '').toLowerCase();
    if (!query || text.indexOf(query) !== -1) {
      card.style.display = '';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  if (!visibleCount && query) {
    if (!emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.className = 'history-empty-search-msg';
      emptyMsg.style.cssText = 'padding:1.5rem;text-align:center;color:var(--text2);font-size:12.5px';
      wrap.appendChild(emptyMsg);
    }
    emptyMsg.style.display = 'block';
    emptyMsg.innerHTML = '<i class="ti ti-search-off" style="font-size:24px;display:block;margin-bottom:6px;color:var(--text3)"></i>No documents matching "<strong>' + esc(query) + '</strong>".';
  } else if (emptyMsg) {
    emptyMsg.style.display = 'none';
  }
}

function clearHistorySearch() {
  var input = document.getElementById('historySearchInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  filterHistoryList();
}
async function loadSavedDoc(id) {
  try {
    var url = sbBase() + '/rest/v1/invoice_documents?id=eq.' + encodeURIComponent(id) + '&select=snapshot';
    var r = await fetch(url, { headers: sbHeaders(gv('sbKey').trim()) });
    if (!r.ok) { var errText = await r.text(); throw new Error(errText || ('HTTP ' + r.status)); }
    var rows = await r.json();
    if (!rows.length) { alert('This saved document could not be found.'); return; }
    var snapshot = rows[0].snapshot;
    applyDocSnapshot(snapshot);
    markDocClean();
    showPane('editor');
  } catch (e) {
    console.error('Load failed', e);
    if (isMissingTableError(e.message)) { offerCreateTables(); }
    else { alert('Could not load this document from Supabase: ' + e.message); }
  }
}
async function loadDocAsRevision(id) {
  await loadSavedDoc(id);
  var curNum = gv('docNum');
  var revNum = bumpDocRevision(curNum);
  document.getElementById('docNum').value = revNum;
  docNumManual = true;
  render();
  alert('Loaded ' + (curNum || 'document') + ' as revision: ' + revNum + '\n\nMake your changes (add/remove items) and press Save to keep both versions.');
}
async function deleteSavedDoc(id) {
  if (!confirm('Delete this saved document from Supabase? This cannot be undone.')) return;
  try {
    var url = sbBase() + '/rest/v1/invoice_documents?id=eq.' + encodeURIComponent(id);
    var r = await fetch(url, { method: 'DELETE', headers: sbHeaders(gv('sbKey').trim()) });
    if (!r.ok) { var errText = await r.text(); throw new Error(errText || ('HTTP ' + r.status)); }
    refreshHistoryList();
  } catch (e) {
    console.error('Delete failed', e);
    if (isMissingTableError(e.message)) { offerCreateTables(); }
    else { alert('Could not delete this document: ' + e.message); }
  }
}

// ---- Backup / restore (fixes storage not surviving a re-download or a new browser) ----
function exportBackup() {
  try {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('invoicegen:') === 0) data[k] = localStorage.getItem(k);
    }
    if (!Object.keys(data).length) { alert('Nothing saved yet - click Save first, then export.'); return; }
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'invoicegen-backup-' + localISODate() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export failed', e);
    alert('Could not export backup.');
  }
}
function importBackup(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = async function(e) {
    try {
      var data = JSON.parse(e.target.result);
      Object.keys(data).forEach(function(k){
        localStorage.setItem(k, data[k]);
      });
      loadSupabaseCreds();
      refreshHistoryList();
      alert('Backup imported successfully. Your Supabase connection and local settings have been restored — saved documents themselves live in Supabase and are unaffected by this.');
    } catch (err) {
      console.error('Import failed', err);
      alert('Could not read that backup file. Make sure it is a JSON file exported from Export Backup.');
    } finally {
      document.getElementById('importBackupInput').value = '';
    }
  };
  reader.readAsText(file);
}





// ── PRECONFIGURED PUBLIC SUPABASE CONNECTION ──
// These are browser-safe client settings. Never put a service-role/secret key here.
const EVENTMEDIA_PUBLIC_CONFIG = Object.freeze({
  supabaseUrl: 'https://fycfdsxvnnjoeczhdbfo.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5Y2Zkc3h2bm5qb2VjemhkYmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMzM3ODIsImV4cCI6MjEwMDcwOTc4Mn0.Pq9_753D6dAT-OtHAAs20ULsFsC6VVYBClUFt0z8Rmw',
  workspaceId: 'XTMNouuQ8iqJesxgH2R4'
});

function ensureEventMediaPublicConfig(){
  try{
    var urlEl=document.getElementById('sbUrl');
    var keyEl=document.getElementById('sbKey');
    var wsEl=document.getElementById('sbWorkspace');

    // Always use the approved project/workspace for this deployed app.
    if(urlEl)urlEl.value=EVENTMEDIA_PUBLIC_CONFIG.supabaseUrl;
    if(keyEl)keyEl.value=EVENTMEDIA_PUBLIC_CONFIG.anonKey;
    if(wsEl)wsEl.value=EVENTMEDIA_PUBLIC_CONFIG.workspaceId;

    localStorage.setItem('invoice:supabase:url',EVENTMEDIA_PUBLIC_CONFIG.supabaseUrl);
    localStorage.setItem('invoice:supabase:key',EVENTMEDIA_PUBLIC_CONFIG.anonKey);
    localStorage.setItem('invoice:supabase:workspace',EVENTMEDIA_PUBLIC_CONFIG.workspaceId);
  }catch(e){console.warn('Could not initialize public Supabase config',e);}
}

// ── PROFILE AUTHENTICATION / ROLE ACCESS ──
var PROFILE_SESSION = null;
var PROFILE_CURRENT = null;
var PROFILE_SQL = document.getElementById('supabaseSqlCode') ? document.getElementById('supabaseSqlCode').textContent : '';

function profileAuthBase(){ return sbBase() + '/auth/v1'; }
function profileAnonHeaders(extra){
  var key=gv('sbKey').trim(), h={'apikey':key,'Content-Type':'application/json'};
  if(extra)Object.keys(extra).forEach(function(k){h[k]=extra[k];});
  return h;
}
function saveProfileSession(s){
  PROFILE_SESSION=s||null;
  try{
    var remember=document.getElementById('rememberLogin');
    var keep=remember ? remember.checked : (localStorage.getItem('eventmedia:rememberLogin')!=='0');
    localStorage.setItem('eventmedia:rememberLogin',keep?'1':'0');
    if(s){
      if(keep){
        localStorage.setItem('eventmedia:profile:session',JSON.stringify(s));
        sessionStorage.removeItem('eventmedia:profile:session');
      }else{
        sessionStorage.setItem('eventmedia:profile:session',JSON.stringify(s));
        localStorage.removeItem('eventmedia:profile:session');
      }
    }else{
      localStorage.removeItem('eventmedia:profile:session');
      sessionStorage.removeItem('eventmedia:profile:session');
    }
  }catch(e){}
}
function loadStoredProfileSession(){
  try{
    var raw=localStorage.getItem('eventmedia:profile:session')||sessionStorage.getItem('eventmedia:profile:session')||'null';
    return JSON.parse(raw);
  }catch(e){return null;}
}
function profileAccessToken(){return PROFILE_SESSION&&PROFILE_SESSION.access_token?PROFILE_SESSION.access_token:'';}
function currentProfileRole(){return PROFILE_CURRENT&&PROFILE_CURRENT.role?PROFILE_CURRENT.role:'';}
function isProfileAdmin(){return currentProfileRole()==='admin';}
function showAuthMode(mode){
  ['login','admin'].forEach(function(x){
    var pane=document.getElementById('authPane'+(x==='login'?'Login':'Admin'));
    var tab=document.getElementById('authTab'+(x==='login'?'Login':'Admin'));
    if(pane)pane.style.display=x===mode?'':'none';
    if(tab)tab.classList.toggle('active',x===mode);
  });
  var st=document.getElementById('authStatus');if(st)st.textContent='';
}
function authStatus(msg,ok){var st=document.getElementById('authStatus');if(st){st.textContent=msg||'';st.style.color=ok?'#16803b':'var(--text2)';}}
async function profileAuthRequest(path,body){
  if(!sbConfigured())throw new Error('Supabase is not configured in this browser. Use the same Project URL, anon key and Workspace ID as your existing system.');
  var r=await fetch(profileAuthBase()+path,{method:'POST',headers:profileAnonHeaders(),body:JSON.stringify(body||{})});
  var data={};try{data=await r.json();}catch(e){}
  if(!r.ok)throw new Error(data.msg||data.error_description||data.message||('HTTP '+r.status));
  return data;
}

function toggleLoginPassword(){
  var p=document.getElementById('authPassword'),b=document.getElementById('passwordEyeBtn');
  if(!p)return;
  var show=p.type==='password';
  p.type=show?'text':'password';
  if(b)b.innerHTML=show?'<i class="ti ti-eye-off"></i>':'<i class="ti ti-eye"></i>';
}
function loadRememberedLogin(){
  try{
    var email=localStorage.getItem('eventmedia:loginEmail')||'';
    var keep=localStorage.getItem('eventmedia:rememberLogin');
    var e=document.getElementById('authEmail'),r=document.getElementById('rememberLogin');
    if(e&&email)e.value=email;
    if(r)r.checked=keep!=='0';
  }catch(e){}
}
function saveRememberedLogin(){
  try{
    var e=document.getElementById('authEmail'),r=document.getElementById('rememberLogin');
    var keep=r?r.checked:true;
    localStorage.setItem('eventmedia:rememberLogin',keep?'1':'0');
    if(keep&&e)localStorage.setItem('eventmedia:loginEmail',e.value.trim());
    else localStorage.removeItem('eventmedia:loginEmail');
  }catch(e){}
}

async function profileSignIn(){
  try{
    authStatus('Signing in...');
    var email=gv('authEmail').trim(),password=gv('authPassword');
    if(!email||!password)throw new Error('Enter your email and password.');
    saveRememberedLogin();
    var data=await profileAuthRequest('/token?grant_type=password',{email:email,password:password});
    saveProfileSession(data);
    await loadCurrentProfile();
    if(!PROFILE_CURRENT||!PROFILE_CURRENT.active)throw new Error('This profile is not active. Ask the Admin to enable it.');
    applyProfileAccess();
    authStatus('');
  }catch(e){saveProfileSession(null);PROFILE_CURRENT=null;authStatus(e.message);}
}
async function profileSignup(email,password,fullName,inviteCode){
  var body={email:email,password:password,data:{workspace_id:gv('sbWorkspace').trim(),full_name:fullName||''}};
  if(inviteCode)body.data.invite_code=inviteCode;
  return profileAuthRequest('/signup',body);
}
async function profileCreateAdmin(){
  try{
    authStatus('Creating Admin profile...');
    var email=gv('authAdminEmail').trim(),password=gv('authAdminPassword'),name=gv('authAdminName').trim();
    if(!name||!email||password.length<6)throw new Error('Enter your name, email and a password of at least 6 characters.');
    var data=await profileSignup(email,password,name,'');
    if(data.access_token){saveProfileSession(data);await loadCurrentProfile();applyProfileAccess();authStatus('Admin profile created.',true);}
    else authStatus('Admin account created. If email confirmation is enabled in Supabase, confirm the email, then use Sign in.',true);
  }catch(e){authStatus(e.message);}
}
async function refreshProfileSession(){
  if(!PROFILE_SESSION||!PROFILE_SESSION.refresh_token)return false;
  try{
    var data=await profileAuthRequest('/token?grant_type=refresh_token',{refresh_token:PROFILE_SESSION.refresh_token});
    saveProfileSession(data);return true;
  }catch(e){return false;}
}
async function loadCurrentProfile(){
  if(!profileAccessToken()){PROFILE_CURRENT=null;return null;}
  var ws=gv('sbWorkspace').trim();
  var url=sbBase()+'/rest/v1/app_profiles?user_id=eq.'+encodeURIComponent(PROFILE_SESSION.user&&PROFILE_SESSION.user.id?PROFILE_SESSION.user.id:'')+'&select=user_id,workspace_id,email,full_name,role,active&limit=1';
  var r=await fetch(url,{headers:sbHeaders(gv('sbKey').trim())});
  if(r.status===401){if(await refreshProfileSession())return loadCurrentProfile();}
  if(!r.ok)throw new Error('Could not load your profile. Run the updated profile-access SQL first.');
  var rows=await r.json();PROFILE_CURRENT=rows[0]||null;
  if(PROFILE_CURRENT&&PROFILE_CURRENT.workspace_id!==ws)throw new Error('This profile belongs to a different Workspace ID.');
  return PROFILE_CURRENT;
}
async function profileLogout(){
  try{
    if(profileAccessToken())await fetch(profileAuthBase()+'/logout',{method:'POST',headers:profileAnonHeaders({'Authorization':'Bearer '+profileAccessToken()})});
  }catch(e){}
  saveProfileSession(null);PROFILE_CURRENT=null;
  document.body.classList.remove('employee-mode');
  var g=document.getElementById('authGate');if(g)g.style.display='flex';
  document.getElementById('managerView').style.display='none';
  document.querySelector('.main').style.display='';
  ['topUserChip','logoutBtn'].forEach(function(id){var x=document.getElementById(id);if(x)x.style.display='none';});
  showAuthMode('login');
}
function updateProfileChips(){
  var name=PROFILE_CURRENT?(PROFILE_CURRENT.full_name||PROFILE_CURRENT.email||'User'):'';
  var role=PROFILE_CURRENT?(PROFILE_CURRENT.role||''):'';
  [['topUserName',name],['topUserRole',role],['managerUserName',name],['managerUserRole',role]].forEach(function(p){var el=document.getElementById(p[0]);if(el)el.textContent=p[1];});
  var top=document.getElementById('topUserChip'),logout=document.getElementById('logoutBtn');if(top)top.style.display='';if(logout)logout.style.display='';
}
function applyProfileAccess(){
  if(!PROFILE_CURRENT||!PROFILE_CURRENT.active){var g=document.getElementById('authGate');if(g)g.style.display='flex';return;}
  var g=document.getElementById('authGate');if(g)g.style.display='none';
  updateProfileChips();
  if(isProfileAdmin()){
    document.body.classList.remove('employee-mode');
    document.querySelector('.main').style.display='';
    document.getElementById('managerView').style.display='none';
  }else{
    document.body.classList.add('employee-mode');
    document.querySelector('.main').style.display='none';
    document.getElementById('managerView').style.display='';
    showManagerPane('rentals');
    loadManagerData();
  }
}
async function initProfileAuth(){
  ensureEventMediaPublicConfig();
  loadSupabaseCreds();
  ensureEventMediaPublicConfig();
  loadRememberedLogin();
  PROFILE_SESSION=loadStoredProfileSession();
  if(!PROFILE_SESSION){document.getElementById('authGate').style.display='flex';return;}
  try{await loadCurrentProfile();if(PROFILE_CURRENT&&PROFILE_CURRENT.active)applyProfileAccess();else profileLogout();}
  catch(e){console.error(e);saveProfileSession(null);PROFILE_CURRENT=null;document.getElementById('authGate').style.display='flex';authStatus(e.message);}
}
function copyProfileSetupSql(){
  var sql=document.getElementById('supabaseSqlCode')?document.getElementById('supabaseSqlCode').textContent:PROFILE_SQL;
  navigator.clipboard.writeText(sql).then(function(){authStatus('Setup SQL copied. Paste it into your Supabase SQL Editor and Run.',true);}).catch(function(){authStatus('Could not copy automatically. Open the file Setup tab and copy the SQL manually.');});
}

function generateEmployeePassword(){
  var out=secureRandomString(14,'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$');
  var el=document.getElementById('newEmployeePassword');
  if(el)el.value=out;
}
async function adminCreateEmployeeAccount(){
  if(!isProfileAdmin())return alert('Admin access required.');
  var name=gv('newEmployeeName').trim(),email=gv('newEmployeeEmail').trim(),password=gv('newEmployeePassword');
  if(!name||!email||password.length<6){alert('Enter employee name, email and a password of at least 6 characters.');return;}
  if(!confirm('Create an Employee profile for '+email+' with access only to Supplier Rentals and Equipment Hire?'))return;

  var result=document.getElementById('employeeCreateResult');
  if(result)result.innerHTML='<div class="invite-box"><i class="ti ti-loader"></i> Creating employee account securely...</div>';

  try{
    var token=profileAccessToken();
    if(!token)throw new Error('No Admin access token is available. Log out and sign in again.');

    var functionUrl=sbBase()+'/functions/v1/create-employee';
    var r=await fetch(functionUrl,{
      method:'POST',
      headers:{
        'apikey':gv('sbKey').trim(),
        'Authorization':'Bearer '+token,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        workspace_id:gv('sbWorkspace').trim(),
        full_name:name,
        email:email,
        password:password
      })
    });

    var raw=await r.text();
    var data={};
    try{data=raw?JSON.parse(raw):{};}catch(parseErr){data={message:raw};}

    if(!r.ok){
      var serverMsg=data.error||data.message||raw||'Unknown server error';
      var requestId=data.request_id||data.requestId||'';
      var detail='HTTP '+r.status+' '+r.statusText+' — '+serverMsg;
      if(requestId)detail+=' — Request ID: '+requestId;
      throw new Error(detail);
    }

    if(result)result.innerHTML=
      '<div class="invite-box">'+
      '<div style="font-weight:700;color:var(--text);margin-bottom:5px"><i class="ti ti-circle-check"></i> Employee account created</div>'+
      '<div style="font-size:12px;color:var(--text2)">Give the employee these login details:</div>'+
      '<div style="margin-top:7px"><strong>Email:</strong> '+esc(email)+'</div>'+
      '<div style="margin-top:3px"><strong>Temporary password:</strong> <span class="invite-code">'+esc(password)+'</span></div>'+
      '<div style="font-size:11.5px;color:var(--text3);margin-top:7px">Access: Supplier Rentals + Equipment Hire only.</div>'+
      (data.request_id?'<div style="font-size:10.5px;color:var(--text3);margin-top:6px">Request ID: '+esc(data.request_id)+'</div>':'')+
      '</div>';

    document.getElementById('newEmployeeName').value='';
    document.getElementById('newEmployeeEmail').value='';
    document.getElementById('newEmployeePassword').value='';
    loadProfiles();
  }catch(e){
    console.error('Create employee failed',e);
    var msg=e&&e.message?e.message:String(e);
    if(result)result.innerHTML=
      '<div class="invite-box" style="color:#b42318">'+
      '<strong>Could not create employee:</strong> '+esc(msg)+
      '<div style="font-size:11px;margin-top:6px;color:var(--text3)">Check Supabase → Edge Functions → create-employee → Logs and look for the matching Request ID if one is shown.</div>'+
      '</div>';
  }
}


function showAdminSessionDiagnostics(){
  var token=profileAccessToken();
  var info={
    logged_in:!!token,
    profile_loaded:!!PROFILE_CURRENT,
    user_id:PROFILE_CURRENT&&PROFILE_CURRENT.user_id?PROFILE_CURRENT.user_id:null,
    email:PROFILE_CURRENT&&PROFILE_CURRENT.email?PROFILE_CURRENT.email:null,
    role:PROFILE_CURRENT&&PROFILE_CURRENT.role?PROFILE_CURRENT.role:null,
    active:PROFILE_CURRENT?!!PROFILE_CURRENT.active:false,
    workspace_profile:PROFILE_CURRENT&&PROFILE_CURRENT.workspace_id?PROFILE_CURRENT.workspace_id:null,
    workspace_app:gv('sbWorkspace').trim(),
    token_length:token?token.length:0,
    token_prefix:token?token.slice(0,12)+'...':''
  };
  alert('Admin Session Diagnostics\n\n'+JSON.stringify(info,null,2));
}

async function loadProfiles(){
  if(!isProfileAdmin())return;
  var wrap=document.getElementById('profilesList');if(!wrap)return;wrap.innerHTML='<div class="manager-empty">Loading profiles...</div>';
  try{
    var url=sbBase()+'/rest/v1/app_profiles?workspace_id=eq.'+encodeURIComponent(gv('sbWorkspace').trim())+'&select=user_id,email,full_name,role,active,created_at&order=created_at.asc';
    var r=await fetch(url,{headers:sbHeaders(gv('sbKey').trim())});if(!r.ok)throw new Error(await r.text());var rows=await r.json();
    if(!rows.length){wrap.innerHTML='<div class="manager-empty">No profiles found.</div>';return;}
    wrap.innerHTML='<div class="profile-list">'+rows.map(function(p){
      var self=PROFILE_CURRENT&&p.user_id===PROFILE_CURRENT.user_id;
      return '<div class="profile-row"><div class="profile-main"><div class="profile-name">'+esc(p.full_name||p.email||'User')+(self?' <span class="role-chip">You</span>':'')+'</div><div class="profile-meta">'+esc(p.email||'')+'</div></div><div class="profile-controls"><select '+(self?'disabled':'')+' onchange="updateProfileRole(\''+p.user_id+'\',this.value)"><option value="employee" '+(p.role==='employee'?'selected':'')+'>Employee</option><option value="admin" '+(p.role==='admin'?'selected':'')+'>Admin</option></select><button class="btn btn-sm '+(p.active?'btn-success':'')+'" '+(self?'disabled':'')+' onclick="toggleProfileActive(\''+p.user_id+'\','+(!p.active)+')">'+(p.active?'Active':'Disabled')+'</button></div></div>';
    }).join('')+'</div>';
  }catch(e){wrap.innerHTML='<div class="manager-empty">Could not load profiles: '+esc(e.message)+'</div>';}
}
async function secureProfileAction(payload){
  if(!isProfileAdmin())throw new Error('Admin access required.');
  var token=profileAccessToken();
  if(!token)throw new Error('Your Admin session has expired. Sign in again.');
  var r=await fetch(sbBase()+'/functions/v1/manage-profile',{
    method:'POST',
    headers:{
      'apikey':gv('sbKey').trim(),
      'Authorization':'Bearer '+token,
      'Content-Type':'application/json'
    },
    body:JSON.stringify(Object.assign({workspace_id:gv('sbWorkspace').trim()},payload))
  });
  var raw=await r.text(),data={};
  try{data=raw?JSON.parse(raw):{};}catch(e){data={message:raw};}
  if(!r.ok)throw new Error(data.error||data.message||('HTTP '+r.status));
  return data;
}
async function updateProfileRole(uid,role){
  if(!isProfileAdmin()||!confirm('Change this profile role to '+role+'?')){loadProfiles();return;}
  try{
    await secureProfileAction({action:'set_role',user_id:uid,role:role});
    loadProfiles();
  }catch(e){alert(e.message);loadProfiles();}
}
async function toggleProfileActive(uid,active){
  if(!isProfileAdmin()||!confirm((active?'Enable':'Disable')+' this employee profile?'))return;
  try{
    await secureProfileAction({action:'set_active',user_id:uid,active:!!active});
    loadProfiles();
  }catch(e){alert(e.message);}
}


// ── BUSINESS MANAGER ──
var managerState = { invoices: [], payments: [], paymentReceipts: [], rentals: [], equipmentHires: [], expenses: [], dbRows: [], dbTable: 'invoice_documents', adminRows: [], adminTable: 'invoice_documents' };
var MANAGER_SQL = document.getElementById('supabaseSqlCode') ? document.getElementById('supabaseSqlCode').textContent : '';

function openManager() {
  document.querySelector('.main').style.display = 'none';
  document.getElementById('managerView').style.display = '';
  var sqlBox = document.getElementById('managerSqlCode'); if (sqlBox) sqlBox.textContent = MANAGER_SQL;
  var rm = document.getElementById('reportMonth'); if (rm && !rm.value) rm.value = localISOMonth();
  loadManagerData();
}
function closeManager() {
  if(!isProfileAdmin()){ showManagerPane('rentals'); return; }
  document.getElementById('managerView').style.display = 'none';
  document.querySelector('.main').style.display = '';
}
function showManagerPane(name) {
  if(!isProfileAdmin() && ['rentals','equipmenthire'].indexOf(name)<0){ name='rentals'; }
  ['dashboard','invoices','payments','rentals','equipmenthire','finance','reports','database','profiles','admin','setup'].forEach(function(x){
    var pane=document.getElementById('managerPane-'+x), tab=document.getElementById('managerTab-'+x);
    if (pane) pane.style.display = x===name ? '' : 'none';
    if (tab) tab.classList.toggle('active',x===name);
  });
  if (name==='payments') renderPaymentReceipts();
  if (name==='equipmenthire') renderEquipmentHires();
  if (name==='finance') renderFinance();
  if (name==='reports') renderReports();
  if (name==='database') loadDatabaseViewer();
  if (name==='profiles') loadProfiles();
  if (name==='admin') loadAdminTable();
}
function managerMoney(n, sym) { return (sym || 'Rs. ') + Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function managerDate(v) { if (!v) return '—'; try { return new Date(v+'T00:00:00').toLocaleDateString('en-GB'); } catch(e){ return v; } }
function managerToday() { return localISODate(); }
function invoicePaidAmount(inv) {
  var receipts = (managerState.paymentReceipts || []).filter(function(p){ return p.invoice_id===inv.id; });
  if (receipts.length > 0) {
    return receipts.reduce(function(a,p){ return a + Number(p.amount||0); }, 0);
  }
  var legacy = (managerState.payments || []).filter(function(p){ return p.invoice_id===inv.id; });
  if (legacy.length > 0) {
    return legacy.reduce(function(a,p){ return a + Number(p.amount||0); }, 0);
  }
  return Number(inv.amount_paid || 0);
}
function invoiceStatus(inv) {
  var total=Number(inv.grand_total||0), paid=invoicePaidAmount(inv);
  if (total>0 && paid >= total-0.005) return 'paid';
  if (paid>0) return 'partial';
  if (inv.due_date && inv.due_date < managerToday()) return 'overdue';
  return 'unpaid';
}
function statusBadge(st) { return '<span class="status-badge status-'+esc(st)+'">'+esc(String(st).replace(/_/g,' '))+'</span>'; }
function managerNeedSetup(message) {
  var box=document.getElementById('managerConnectionAlert');
  if (!box) return;
  box.innerHTML='<div class="manager-alert"><strong>Manager setup needed.</strong> '+esc(message||'Run the manager SQL in Supabase, then refresh.')+' <button class="btn btn-sm btn-primary" style="margin-left:.4rem" onclick="showManagerPane(\'setup\')">Open Setup</button></div>';
}
async function managerGet(table, select) {
  if(!PROFILE_CURRENT||!PROFILE_CURRENT.active) throw new Error('Sign in first.');
  var ws=gv('sbWorkspace').trim();
  var url=sbBase()+'/rest/v1/'+table+'?workspace_id=eq.'+encodeURIComponent(ws)+'&select='+encodeURIComponent(select||'*')+'&order=created_at.desc&limit=1000';
  var r=await fetch(url,{headers:sbHeaders(gv('sbKey').trim())});
  if(!r.ok){var tx=await r.text();throw new Error(tx||('HTTP '+r.status));}
  return r.json();
}
async function loadManagerData() {
  var alertBox=document.getElementById('managerConnectionAlert');
  if (!sbConfigured()) {
    if(alertBox) alertBox.innerHTML='<div class="manager-alert"><strong>Supabase is not connected.</strong> Enter the Project URL, anon key and Workspace ID on the Admin browser first.</div>';
    managerState={invoices:[],payments:[],paymentReceipts:[],rentals:[],equipmentHires:[],expenses:[]}; renderManagerAll(); return;
  }
  if(!PROFILE_CURRENT||!PROFILE_CURRENT.active){if(alertBox)alertBox.innerHTML='<div class="manager-alert"><strong>Profile login required.</strong></div>';return;}
  if(alertBox) alertBox.innerHTML='<div class="manager-alert" style="color:var(--text2);background:var(--surface);border-color:var(--border)"><i class="ti ti-loader"></i> Loading permitted business data from Supabase...</div>';
  try {
    if(isProfileAdmin()){
      var results=await Promise.all([
        managerGet('invoice_documents','id,doc_number,doc_type,client_name,event_name,grand_total,currency,issue_date,due_date,payment_status,amount_paid,snapshot,created_at,updated_at'),
        managerGet('invoice_payments','id,invoice_id,amount,payment_date,method,reference,notes,created_at').catch(function(){ return []; }),
        managerGet('payment_receipts','id,receipt_no,payment_date,customer_id,client_name,invoice_id,event_name,amount,payment_method,reference_no,bank_account,notes,created_by,created_at,updated_at').catch(function(){ return []; }),
        managerGet('equipment_rentals','id,supplier_name,supplier_contact,event_name,item_description,quantity,rent_date,return_date,amount,amount_paid,status,notes,created_at,updated_at'),
        managerGet('owned_equipment_hires','id,customer_name,customer_contact,event_name,item_description,quantity,hire_date,return_date,amount,amount_paid,payment_status,hire_status,payment_method,reference,notes,created_at,updated_at'),
        managerGet('other_expenses','id,expense_date,category,description,event_name,amount,payment_method,reference,notes,created_at,updated_at')
      ]);
      managerState.invoices=results[0].filter(function(x){return x.doc_type==='Invoice'||x.doc_type==='Proforma Invoice';});
      managerState.payments=results[1]||[];
      managerState.paymentReceipts=results[2]||[];
      managerState.rentals=results[3]||[];
      managerState.equipmentHires=results[4]||[];
      managerState.expenses=results[5]||[];
    }else{
      var staff=await Promise.all([
        managerGet('equipment_rentals','id,supplier_name,supplier_contact,event_name,item_description,quantity,rent_date,return_date,amount,amount_paid,status,notes,created_at,updated_at'),
        managerGet('owned_equipment_hires','id,customer_name,customer_contact,event_name,item_description,quantity,hire_date,return_date,amount,amount_paid,payment_status,hire_status,payment_method,reference,notes,created_at,updated_at')
      ]);
      managerState.invoices=[];managerState.payments=[];managerState.paymentReceipts=[];managerState.rentals=staff[0]||[];managerState.equipmentHires=staff[1]||[];managerState.expenses=[];
    }
    if(alertBox) alertBox.innerHTML='';
    renderManagerAll();
  } catch(e) {
    console.error('Manager load failed',e);
    if(alertBox)alertBox.innerHTML='<div class="manager-alert"><strong>Access/setup error.</strong> '+esc(e.message)+'</div>';
    renderManagerAll();
  }
}
function renderManagerAll(){ renderManagerDashboard(); renderManagerInvoices(); renderPaymentReceipts(); renderRentals(); renderEquipmentHires(); renderFinance(); renderExpenses(); renderReports(); }
function renderManagerDashboard(){
  var invs=managerState.invoices, rentals=managerState.rentals;
  var billed=invs.reduce(function(a,x){return a+Number(x.grand_total||0);},0);
  var collected=invs.reduce(function(a,x){return a+Math.min(invoicePaidAmount(x),Number(x.grand_total||0));},0);
  var outstanding=Math.max(0,billed-collected);
  var rentalCost=rentals.filter(function(r){return r.status!=='cancelled';}).reduce(function(a,r){return a+Number(r.amount||0);},0);
  var hireRevenue=managerState.equipmentHires.filter(function(h){return h.hire_status!=='cancelled';}).reduce(function(a,h){return a+Number(h.amount||0);},0);
  var hireReceived=managerState.equipmentHires.filter(function(h){return h.hire_status!=='cancelled';}).reduce(function(a,h){return a+Number(h.amount_paid||0);},0);
  var overdue=invs.filter(function(x){return invoiceStatus(x)==='overdue';}).length;
  var metrics=document.getElementById('managerMetrics'); if(metrics) metrics.innerHTML=
    '<div class="metric-card"><div class="metric-label">Total invoiced</div><div class="metric-value">'+managerMoney(billed)+'</div><div class="metric-note">'+invs.length+' invoice(s)</div></div>'+ 
    '<div class="metric-card"><div class="metric-label">Collected</div><div class="metric-value">'+managerMoney(collected)+'</div><div class="metric-note">'+(managerState.paymentReceipts.length || managerState.payments.length)+' payment receipt(s)</div></div>'+ 
    '<div class="metric-card"><div class="metric-label">Outstanding</div><div class="metric-value">'+managerMoney(outstanding)+'</div><div class="metric-note">'+overdue+' overdue invoice(s)</div></div>'+ 
    '<div class="metric-card"><div class="metric-label">Supplier rental cost</div><div class="metric-value">'+managerMoney(rentalCost)+'</div><div class="metric-note">'+rentals.length+' rental record(s)</div></div>'+ '<div class="metric-card"><div class="metric-label">Our Equipment Hire Income</div><div class="metric-value">'+managerMoney(hireRevenue)+'</div><div class="metric-note">'+managerMoney(hireReceived)+' received</div></div>';
  var out=invs.filter(function(x){return invoiceStatus(x)!=='paid';}).sort(function(a,b){return String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'));}).slice(0,6);
  var di=document.getElementById('dashboardInvoices'); if(di){ if(!out.length) di.innerHTML='<div class="manager-empty">No outstanding invoices.</div>'; else di.innerHTML='<div class="manager-table-wrap"><table class="manager-table" style="min-width:620px"><thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th>Balance</th><th>Status</th></tr></thead><tbody>'+out.map(function(x){var bal=Math.max(0,Number(x.grand_total||0)-invoicePaidAmount(x));return '<tr><td>'+esc(x.doc_number)+'</td><td>'+esc(x.client_name||'—')+'</td><td>'+managerDate(x.due_date)+'</td><td class="manager-money">'+managerMoney(bal,x.currency)+'</td><td>'+statusBadge(invoiceStatus(x))+'</td></tr>';}).join('')+'</tbody></table></div>'; }
  var upcoming=rentals.filter(function(r){return r.status!=='returned'&&r.status!=='paid'&&r.status!=='cancelled'&&r.return_date;}).sort(function(a,b){return String(a.return_date).localeCompare(String(b.return_date));}).slice(0,6);
  var dr=document.getElementById('dashboardRentals'); if(dr){if(!upcoming.length)dr.innerHTML='<div class="manager-empty">No upcoming rental returns.</div>';else dr.innerHTML='<div class="manager-table-wrap"><table class="manager-table" style="min-width:560px"><thead><tr><th>Supplier</th><th>Item</th><th>Return</th><th>Status</th></tr></thead><tbody>'+upcoming.map(function(r){return '<tr><td>'+esc(r.supplier_name)+'</td><td>'+esc(r.item_description)+'</td><td>'+managerDate(r.return_date)+'</td><td>'+statusBadge(r.status)+'</td></tr>';}).join('')+'</tbody></table></div>';}
}
function renderManagerInvoices(){
  var wrap=document.getElementById('managerInvoiceTable'); if(!wrap)return;
  var q=(gv('managerInvoiceSearch')||'').toLowerCase(), fs=gv('managerInvoiceStatus')||'all';
  var rows=managerState.invoices.filter(function(x){var st=invoiceStatus(x);var hay=[x.doc_number,x.client_name,x.event_name].join(' ').toLowerCase();return (!q||hay.indexOf(q)>=0)&&(fs==='all'||st===fs);}).sort(function(a,b){return String(b.issue_date||b.created_at||'').localeCompare(String(a.issue_date||a.created_at||''));});
  if(!rows.length){wrap.innerHTML='<div class="manager-empty">No invoices match this filter. Save an Invoice from the generator and it will appear here.</div>';return;}
  wrap.innerHTML='<div class="manager-table-wrap"><table class="manager-table"><thead><tr><th>Invoice</th><th>Client / Event</th><th>Issued</th><th>Due</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+rows.map(function(x){var paid=invoicePaidAmount(x),total=Number(x.grand_total||0),bal=Math.max(0,total-paid);var payCount=(managerState.paymentReceipts||[]).filter(function(p){return p.invoice_id===x.id;}).length;return '<tr><td><strong>'+esc(x.doc_number)+'</strong></td><td>'+esc(x.client_name||'—')+(x.event_name?'<div style="font-size:11px;color:var(--text3)">'+esc(x.event_name)+'</div>':'')+'</td><td>'+managerDate(x.issue_date)+'</td><td>'+managerDate(x.due_date)+'</td><td class="manager-money">'+managerMoney(total,x.currency)+'</td><td class="manager-money">'+managerMoney(paid,x.currency)+'</td><td class="manager-money">'+managerMoney(bal,x.currency)+'</td><td>'+statusBadge(invoiceStatus(x))+'</td><td style="white-space:nowrap"><button class="btn btn-sm btn-primary" onclick="openPaymentReceiptModal({invoiceId:\''+x.id+'\'})" title="Record Payment Received"><i class="ti ti-plus"></i> Payment</button> <button class="btn btn-sm" onclick="openInvoiceHistory(\''+x.id+'\')" title="View Payment History"><i class="ti ti-history"></i> History '+(payCount?'('+payCount+')':'')+'</button> <button class="btn btn-sm" onclick="loadManagerInvoice(\''+x.id+'\')"><i class="ti ti-folder-open"></i> Open</button></td></tr>';}).join('')+'</tbody></table></div>';
}
async function loadManagerInvoice(id){ closeManager(); await loadSavedDoc(id); }
// ── PAYMENT RECEIVED & RECEIPT MANAGEMENT ──
function populatePaymentCustomerDropdown() {
  var custSelect = document.getElementById('paymentReceiptCustomer');
  var filterSelect = document.getElementById('managerPaymentCustomerFilter');
  var customers = {};
  (managerState.invoices || []).forEach(function(x) {
    if (x.client_name && x.client_name.trim()) customers[x.client_name.trim()] = true;
  });
  (managerState.paymentReceipts || []).forEach(function(x) {
    if (x.client_name && x.client_name.trim()) customers[x.client_name.trim()] = true;
  });
  var sortedCusts = Object.keys(customers).sort(function(a, b) { return a.localeCompare(b); });
  
  if (custSelect) {
    var cur = custSelect.value;
    custSelect.innerHTML = '<option value="">Select customer...</option>' + sortedCusts.map(function(c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');
    if (cur && customers[cur]) custSelect.value = cur;
  }
  if (filterSelect) {
    var curF = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">All customers</option>' + sortedCusts.map(function(c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');
    if (curF) filterSelect.value = curF;
  }
}

function populatePaymentInvoiceDropdown(selectedCustomerId, selectedInvoiceId) {
  var invSelect = document.getElementById('paymentReceiptInvoice');
  if (!invSelect) return;
  var invoices = (managerState.invoices || []).slice();
  if (selectedCustomerId) {
    invoices = invoices.filter(function(x) {
      return (x.client_name || '').trim().toLowerCase() === selectedCustomerId.trim().toLowerCase();
    });
  }
  invoices.sort(function(a, b) {
    var stA = invoiceStatus(a), stB = invoiceStatus(b);
    var priA = (stA === 'unpaid' ? 1 : (stA === 'partial' || stA === 'overdue' ? 2 : 3));
    var priB = (stB === 'unpaid' ? 1 : (stB === 'partial' || stB === 'overdue' ? 2 : 3));
    if (priA !== priB) return priA - priB;
    return String(b.issue_date || b.created_at || '').localeCompare(String(a.issue_date || a.created_at || ''));
  });

  invSelect.innerHTML = '<option value="">Select invoice...</option>' + invoices.map(function(x) {
    var paid = invoicePaidAmount(x);
    var total = Number(x.grand_total || 0);
    var bal = Math.max(0, total - paid);
    var st = invoiceStatus(x);
    var label = esc(x.doc_number) + ' — ' + esc(x.client_name || 'Client') + ' (Total: ' + managerMoney(total, x.currency) + ', Bal: ' + managerMoney(bal, x.currency) + ' [' + st.toUpperCase() + '])';
    return '<option value="' + esc(x.id) + '">' + label + '</option>';
  }).join('');

  if (selectedInvoiceId) {
    invSelect.value = selectedInvoiceId;
  }
}

async function regenerateReceiptNumber() {
  var docInput = document.getElementById('paymentReceiptDocNum');
  if (!docInput) return;
  var prev = docInput.value;
  docInput.value = '…';
  try {
    docInput.value = await generateReceiptNumber(false);
  } catch (e) {
    console.error(e);
    docInput.value = prev || ('PR-' + new Date().getFullYear() + '-0001');
  }
}

async function openPaymentReceiptModal(opts) {
  opts = opts || {};
  var editId = opts.receiptId || null;
  var preInvoiceId = opts.invoiceId || null;

  document.getElementById('paymentReceiptEditId').value = editId || '';
  document.getElementById('paymentReceiptDate').value = managerToday();
  document.getElementById('paymentReceiptMethod').value = 'Bank Transfer';
  document.getElementById('paymentReceiptReference').value = '';
  document.getElementById('paymentReceiptBank').value = 'Seylan Bank, Maharagama A/C 0080 3485 3012 001';
  document.getElementById('paymentReceiptNotes').value = '';
  document.getElementById('paymentReceiptAmount').value = '';
  document.getElementById('paymentReceiptEvent').value = '';
  var alertBox = document.getElementById('paymentReceiptOverpayAlert');
  if (alertBox) alertBox.style.display = 'none';

  populatePaymentCustomerDropdown();

  if (editId) {
    var receipt = (managerState.paymentReceipts || []).find(function(r) { return r.id === editId; });
    if (!receipt) { alert('Receipt not found.'); return; }
    document.getElementById('paymentReceiptModalTitle').textContent = 'Edit Payment Received';
    document.getElementById('paymentReceiptModalSub').textContent = 'Update recorded receipt details and synchronize invoice balance.';
    document.getElementById('savePaymentReceiptBtn').innerHTML = '<i class="ti ti-device-floppy"></i> Update Payment Received';

    document.getElementById('paymentReceiptDocNum').value = receipt.receipt_no || '';
    document.getElementById('paymentReceiptDate').value = receipt.payment_date || managerToday();
    document.getElementById('paymentReceiptCustomer').value = receipt.client_name || '';
    populatePaymentInvoiceDropdown(receipt.client_name || '', receipt.invoice_id);
    document.getElementById('paymentReceiptInvoice').value = receipt.invoice_id || '';
    document.getElementById('paymentReceiptEvent').value = receipt.event_name || '';
    document.getElementById('paymentReceiptAmount').value = Number(receipt.amount || 0).toFixed(2);
    document.getElementById('paymentReceiptMethod').value = receipt.payment_method || 'Bank Transfer';
    document.getElementById('paymentReceiptReference').value = receipt.reference_no || '';
    document.getElementById('paymentReceiptBank').value = receipt.bank_account || '';
    document.getElementById('paymentReceiptNotes').value = receipt.notes || '';

    updateReceiptBalanceCards();
  } else {
    document.getElementById('paymentReceiptModalTitle').textContent = 'Record Payment Received';
    document.getElementById('paymentReceiptModalSub').textContent = 'Create a verified payment receipt against a customer invoice.';
    document.getElementById('savePaymentReceiptBtn').innerHTML = '<i class="ti ti-device-floppy"></i> Save Payment Received';

    await regenerateReceiptNumber();

    if (preInvoiceId) {
      var inv = (managerState.invoices || []).find(function(x) { return x.id === preInvoiceId; });
      if (inv) {
        document.getElementById('paymentReceiptCustomer').value = inv.client_name || '';
        populatePaymentInvoiceDropdown(inv.client_name || '', preInvoiceId);
        document.getElementById('paymentReceiptInvoice').value = preInvoiceId;
        document.getElementById('paymentReceiptEvent').value = inv.event_name || '';
        updateReceiptBalanceCards();
      } else {
        populatePaymentInvoiceDropdown();
      }
    } else {
      populatePaymentInvoiceDropdown();
      updateReceiptBalanceCards();
    }
  }

  document.getElementById('paymentReceiptModal').classList.add('open');
}

function closePaymentReceiptModal() {
  document.getElementById('paymentReceiptModal').classList.remove('open');
}

function onPaymentReceiptCustomerChange() {
  var cust = gv('paymentReceiptCustomer').trim();
  populatePaymentInvoiceDropdown(cust);
  var invSelect = document.getElementById('paymentReceiptInvoice');
  if (invSelect && invSelect.options.length === 2) {
    invSelect.selectedIndex = 1;
  }
  onPaymentReceiptInvoiceChange();
}

function onPaymentReceiptInvoiceChange() {
  var invId = gv('paymentReceiptInvoice');
  var inv = (managerState.invoices || []).find(function(x) { return x.id === invId; });
  if (inv) {
    if (!gv('paymentReceiptCustomer')) {
      document.getElementById('paymentReceiptCustomer').value = inv.client_name || '';
    }
    if (!gv('paymentReceiptEvent') || gv('paymentReceiptEvent') !== inv.event_name) {
      document.getElementById('paymentReceiptEvent').value = inv.event_name || '';
    }
  }
  updateReceiptBalanceCards();
}

function updateReceiptBalanceCards() {
  var invId = gv('paymentReceiptInvoice');
  var editId = gv('paymentReceiptEditId');
  var totalEl = document.getElementById('receiptCardTotal');
  var paidEl = document.getElementById('receiptCardPaid');
  var balEl = document.getElementById('receiptCardBalance');
  if (!totalEl || !paidEl || !balEl) return;

  var inv = (managerState.invoices || []).find(function(x) { return x.id === invId; });
  if (!inv) {
    totalEl.textContent = 'Rs. 0.00';
    paidEl.textContent = 'Rs. 0.00';
    balEl.textContent = 'Rs. 0.00';
    return;
  }

  var invTotal = Number(inv.grand_total || 0);
  var receipts = (managerState.paymentReceipts || []).filter(function(r) {
    return r.invoice_id === invId && (!editId || r.id !== editId);
  });
  var prevPaid = receipts.reduce(function(a, r) { return a + Number(r.amount || 0); }, 0);
  if (receipts.length === 0) {
    var legacy = (managerState.payments || []).filter(function(p) { return p.invoice_id === invId; });
    if (legacy.length > 0) {
      prevPaid = legacy.reduce(function(a, p) { return a + Number(p.amount || 0); }, 0);
    }
  }

  var bal = Math.max(0, invTotal - prevPaid);
  totalEl.textContent = managerMoney(invTotal, inv.currency);
  paidEl.textContent = managerMoney(prevPaid, inv.currency);
  balEl.textContent = managerMoney(bal, inv.currency);

  var amtInput = document.getElementById('paymentReceiptAmount');
  if (amtInput && (!amtInput.value || Number(amtInput.value) <= 0) && !editId && bal > 0) {
    amtInput.value = bal.toFixed(2);
  }

  onPaymentReceiptAmountInput();
}

function onPaymentReceiptAmountInput() {
  var invId = gv('paymentReceiptInvoice');
  var editId = gv('paymentReceiptEditId');
  var alertBox = document.getElementById('paymentReceiptOverpayAlert');
  var amtInput = document.getElementById('paymentReceiptAmount');
  if (!amtInput) return;

  var amount = Number(amtInput.value || 0);
  var inv = (managerState.invoices || []).find(function(x) { return x.id === invId; });
  if (!inv || amount <= 0) {
    if (alertBox) alertBox.style.display = 'none';
    amtInput.style.borderColor = '';
    return;
  }

  var invTotal = Number(inv.grand_total || 0);
  var receipts = (managerState.paymentReceipts || []).filter(function(r) {
    return r.invoice_id === invId && (!editId || r.id !== editId);
  });
  var prevPaid = receipts.reduce(function(a, r) { return a + Number(r.amount || 0); }, 0);
  if (receipts.length === 0) {
    var legacy = (managerState.payments || []).filter(function(p) { return p.invoice_id === invId; });
    if (legacy.length > 0) {
      prevPaid = legacy.reduce(function(a, p) { return a + Number(p.amount || 0); }, 0);
    }
  }

  var maxAllowed = Math.max(0, invTotal - prevPaid);
  if (amount > maxAllowed + 0.005) {
    amtInput.style.borderColor = '#dc2626';
    if (alertBox) {
      alertBox.style.display = 'block';
      alertBox.innerHTML = '<div class="receipt-overpay-warning"><i class="ti ti-alert-triangle"></i> Amount entered (' + managerMoney(amount, inv.currency) + ') exceeds the outstanding balance (' + managerMoney(maxAllowed, inv.currency) + '). Maximum allowed is ' + managerMoney(maxAllowed, inv.currency) + '.</div>';
    }
  } else {
    amtInput.style.borderColor = '';
    if (alertBox) alertBox.style.display = 'none';
  }
}

function onPaymentReceiptMethodChange() {
  var method = gv('paymentReceiptMethod');
  var bankInput = document.getElementById('paymentReceiptBank');
  if (method === 'Bank Transfer' && bankInput && !bankInput.value) {
    bankInput.value = 'Seylan Bank, Maharagama A/C 0080 3485 3012 001';
  }
}

async function savePaymentReceipt() {
  var editId = gv('paymentReceiptEditId');
  var receiptNo = gv('paymentReceiptDocNum').trim();
  var payDate = gv('paymentReceiptDate');
  var customer = gv('paymentReceiptCustomer').trim();
  var invId = gv('paymentReceiptInvoice');
  var eventName = gv('paymentReceiptEvent').trim();
  var amount = Number(gv('paymentReceiptAmount') || 0);
  var method = gv('paymentReceiptMethod');
  var refNo = gv('paymentReceiptReference').trim();
  var bankAcc = gv('paymentReceiptBank').trim();
  var notes = gv('paymentReceiptNotes').trim();

  if (!receiptNo) { alert('Receipt number is required.'); return; }
  if (!payDate) { alert('Payment date is required.'); return; }
  if (!invId) { alert('Please select an invoice.'); return; }
  if (amount <= 0 || isNaN(amount)) { alert('Please enter a valid payment amount greater than 0.'); return; }

  var inv = (managerState.invoices || []).find(function(x) { return x.id === invId; });
  if (!inv) { alert('Selected invoice was not found.'); return; }

  var invTotal = Number(inv.grand_total || 0);
  var otherReceipts = (managerState.paymentReceipts || []).filter(function(r) {
    return r.invoice_id === invId && (!editId || r.id !== editId);
  });
  var prevPaid = otherReceipts.reduce(function(a, r) { return a + Number(r.amount || 0); }, 0);
  if (otherReceipts.length === 0) {
    var legacy = (managerState.payments || []).filter(function(p) { return p.invoice_id === invId; });
    if (legacy.length > 0) {
      prevPaid = legacy.reduce(function(a, p) { return a + Number(p.amount || 0); }, 0);
    }
  }
  var maxAllowed = Math.max(0, invTotal - prevPaid);
  if (amount > maxAllowed + 0.005) {
    alert('Payment amount (' + managerMoney(amount, inv.currency) + ') exceeds outstanding balance (' + managerMoney(maxAllowed, inv.currency) + '). Maximum allowed is ' + managerMoney(maxAllowed, inv.currency) + '.');
    return;
  }

  var clientName = customer || inv.client_name || '';
  var payload = {
    workspace_id: gv('sbWorkspace').trim(),
    receipt_no: receiptNo,
    payment_date: payDate,
    customer_id: null,
    client_name: clientName,
    invoice_id: invId,
    event_name: eventName || inv.event_name || '',
    amount: amount,
    payment_method: method,
    reference_no: refNo || null,
    bank_account: bankAcc || null,
    notes: notes || null,
    created_by: (PROFILE_CURRENT && PROFILE_CURRENT.email) || null,
    updated_at: new Date().toISOString()
  };

  var saveBtn = document.getElementById('savePaymentReceiptBtn');
  var origText = saveBtn ? saveBtn.innerHTML : '';
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="ti ti-loader"></i> Saving...'; }

  try {
    var url = sbBase() + '/rest/v1/payment_receipts' + (editId ? '?id=eq.' + encodeURIComponent(editId) : '');
    var httpMethod = editId ? 'PATCH' : 'POST';
    var h = sbHeaders(gv('sbKey').trim(), { 'Prefer': 'return=representation' });
    var r = await fetch(url, { method: httpMethod, headers: h, body: JSON.stringify(payload) });
    if (!r.ok) {
      var tx = await r.text();
      throw new Error(tx || ('HTTP ' + r.status));
    }

    if (!editId) {
      var m = receiptNo.match(/-(\d+)$/);
      if (m) {
        var seqN = parseInt(m[1], 10);
        try { localStorage.setItem(docSeqKey('Payment Received'), String(seqN)); } catch(e){}
      }
    }

    var newTotalPaid = prevPaid + amount;
    var newStatus = (newTotalPaid >= invTotal - 0.005) ? 'paid' : (newTotalPaid > 0 ? 'partial' : 'unpaid');
    
    var invPatchUrl = sbBase() + '/rest/v1/invoice_documents?id=eq.' + encodeURIComponent(invId);
    await fetch(invPatchUrl, {
      method: 'PATCH',
      headers: sbHeaders(gv('sbKey').trim()),
      body: JSON.stringify({ amount_paid: newTotalPaid, payment_status: newStatus, updated_at: new Date().toISOString() })
    }).then(function(pr){
      if (!pr.ok) showToast('Receipt saved, but the invoice payment status could not be updated (HTTP ' + pr.status + '). Balances are still calculated from receipts.', 'error');
    }).catch(function(e){ console.warn(e); });
    showToast('Payment receipt ' + receiptNo + ' saved', 'success');

    closePaymentReceiptModal();
    await loadManagerData();
  } catch (e) {
    console.error('Save payment receipt failed', e);
    var msg = e.message || '';
    if (msg.indexOf('PGRST205') >= 0 || msg.indexOf('payment_receipts') >= 0 || msg.indexOf('schema cache') >= 0) {
      alert('The "payment_receipts" table was not found in your Supabase database.\n\nPlease open the Business Manager -> Setup tab (or your Supabase SQL Editor) and run the updated Setup SQL script once to create the table, then try again.');
    } else {
      alert('Could not save payment receipt: ' + msg);
    }
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = origText; }
  }
}

function editPaymentReceipt(id) {
  openPaymentReceiptModal({ receiptId: id });
}

async function deletePaymentReceipt(id) {
  var receipt = (managerState.paymentReceipts || []).find(function(r) { return r.id === id; });
  if (!receipt) return;
  if (!confirm('Permanently delete Payment Receipt ' + (receipt.receipt_no || '') + ' for ' + managerMoney(receipt.amount) + '?')) return;

  try {
    var r = await fetch(sbBase() + '/rest/v1/payment_receipts?id=eq.' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: sbHeaders(gv('sbKey').trim())
    });
    if (!r.ok) throw new Error(await r.text());

    if (receipt.invoice_id) {
      var inv = (managerState.invoices || []).find(function(x) { return x.id === receipt.invoice_id; });
      if (inv) {
        var remainingReceipts = (managerState.paymentReceipts || []).filter(function(r) {
          return r.invoice_id === receipt.invoice_id && r.id !== id;
        });
        var newPaid = remainingReceipts.reduce(function(a, r) { return a + Number(r.amount || 0); }, 0);
        var total = Number(inv.grand_total || 0);
        var newStatus = (newPaid >= total - 0.005) ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');

        await fetch(sbBase() + '/rest/v1/invoice_documents?id=eq.' + encodeURIComponent(receipt.invoice_id), {
          method: 'PATCH',
          headers: sbHeaders(gv('sbKey').trim()),
          body: JSON.stringify({ amount_paid: newPaid, payment_status: newStatus, updated_at: new Date().toISOString() })
        }).catch(function(e){ console.warn(e); });
      }
    }

    await loadManagerData();
  } catch (e) {
    console.error('Delete payment receipt failed', e);
    alert('Could not delete payment receipt: ' + e.message);
  }
}

function renderPaymentReceipts() {
  var wrap = document.getElementById('managerPaymentTable');
  var metrics = document.getElementById('managerPaymentMetrics');
  if (!wrap) return;

  var allReceipts = managerState.paymentReceipts || [];
  var totalCollected = allReceipts.reduce(function(a, r) { return a + Number(r.amount || 0); }, 0);
  var thisMonth = localISOMonth();
  var monthCollected = allReceipts.filter(function(r) {
    return String(r.payment_date || r.created_at || '').slice(0, 7) === thisMonth;
  }).reduce(function(a, r) { return a + Number(r.amount || 0); }, 0);
  var paidInvoicesCount = (managerState.invoices || []).filter(function(x) { return invoiceStatus(x) === 'paid'; }).length;

  if (metrics) {
    metrics.innerHTML =
      '<div class="metric-card"><div class="metric-label">Total Receipts Collected</div><div class="metric-value">' + managerMoney(totalCollected) + '</div><div class="metric-note">' + allReceipts.length + ' payment receipt(s) issued</div></div>' +
      '<div class="metric-card"><div class="metric-label">Collected This Month</div><div class="metric-value">' + managerMoney(monthCollected) + '</div><div class="metric-note">' + esc(thisMonth) + ' collections</div></div>' +
      '<div class="metric-card"><div class="metric-label">Fully Settled Invoices</div><div class="metric-value">' + paidInvoicesCount + '</div><div class="metric-note">Out of ' + (managerState.invoices || []).length + ' total invoices</div></div>' +
      '<div class="metric-card"><div class="metric-label">Recent Activity</div><div class="metric-value">' + (allReceipts[0] ? managerDate(allReceipts[0].payment_date) : '—') + '</div><div class="metric-note">Latest receipt date</div></div>';
  }

  populatePaymentCustomerDropdown();

  var q = (gv('managerPaymentSearch') || '').toLowerCase();
  var mf = gv('managerPaymentMethodFilter') || 'all';
  var cf = gv('managerPaymentCustomerFilter') || 'all';

  var rows = allReceipts.filter(function(r) {
    var inv = (managerState.invoices || []).find(function(x) { return x.id === r.invoice_id; });
    var invNum = inv ? inv.doc_number : '';
    var hay = [r.receipt_no, r.client_name, r.event_name, r.payment_method, r.reference_no, invNum].join(' ').toLowerCase();
    return (!q || hay.indexOf(q) >= 0) &&
           (mf === 'all' || r.payment_method === mf) &&
           (cf === 'all' || (r.client_name || '').trim().toLowerCase() === cf.trim().toLowerCase());
  }).sort(function(a, b) {
    return String(b.payment_date || b.created_at || '').localeCompare(String(a.payment_date || a.created_at || ''));
  });

  if (!rows.length) {
    wrap.innerHTML = '<div class="manager-empty">No payment receipts match this filter. Click "+ Record Payment Received" to issue a receipt.</div>';
    return;
  }

  wrap.innerHTML = '<div class="manager-table-wrap"><table class="manager-table" style="min-width:980px"><thead><tr>' +
    '<th>Receipt #</th>' +
    '<th>Date</th>' +
    '<th>Customer / Event</th>' +
    '<th>Invoice #</th>' +
    '<th>Method & Ref</th>' +
    '<th>Amount Received</th>' +
    '<th>Actions</th>' +
    '</tr></thead><tbody>' + rows.map(function(r) {
      var inv = (managerState.invoices || []).find(function(x) { return x.id === r.invoice_id; });
      var invDisplay = inv ? '<a href="javascript:void(0)" onclick="openInvoiceHistory(\'' + inv.id + '\')" style="color:var(--accent);font-weight:600">' + esc(inv.doc_number) + '</a>' : '<span style="color:var(--text3)">—</span>';
      return '<tr>' +
        '<td><strong style="color:var(--accent);cursor:pointer" onclick="viewPaymentReceiptDoc(\'' + r.id + '\')" title="Click to view official receipt">' + esc(r.receipt_no) + '</strong></td>' +
        '<td>' + managerDate(r.payment_date) + '</td>' +
        '<td><strong>' + esc(r.client_name || '—') + '</strong>' + (r.event_name ? '<div style="font-size:11px;color:var(--text3)">' + esc(r.event_name) + '</div>' : '') + '</td>' +
        '<td>' + invDisplay + '</td>' +
        '<td>' + esc(r.payment_method || '—') + (r.reference_no ? '<div style="font-size:11px;color:var(--text3)">Ref: ' + esc(r.reference_no) + '</div>' : '') + '</td>' +
        '<td class="manager-money" style="font-weight:700;color:var(--accent)">' + managerMoney(r.amount) + '</td>' +
        '<td style="white-space:nowrap">' +
          '<button class="btn btn-sm btn-primary" onclick="viewPaymentReceiptDoc(\'' + r.id + '\')" title="View Receipt Document"><i class="ti ti-eye"></i> View</button> ' +
          '<button class="btn btn-sm" onclick="editPaymentReceipt(\'' + r.id + '\')" title="Edit Receipt"><i class="ti ti-edit"></i> Edit</button> ' +
          '<button class="btn btn-sm btn-danger" onclick="deletePaymentReceipt(\'' + r.id + '\')" title="Delete Receipt"><i class="ti ti-trash"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';
}

var CURRENT_VIEWING_RECEIPT = null;

function viewPaymentReceiptDoc(id) {
  var receipt = (managerState.paymentReceipts || []).find(function(r) { return r.id === id; });
  if (!receipt) { alert('Receipt not found.'); return; }
  CURRENT_VIEWING_RECEIPT = receipt;

  var inv = (managerState.invoices || []).find(function(x) { return x.id === receipt.invoice_id; });
  var invTotal = inv ? Number(inv.grand_total || 0) : Number(receipt.amount || 0);
  var currency = (inv && inv.currency) || 'Rs. ';

  var allReceiptsForInv = (managerState.paymentReceipts || []).filter(function(r) {
    return r.invoice_id === receipt.invoice_id;
  }).sort(function(a, b) {
    return String(a.payment_date || a.created_at || '').localeCompare(String(b.payment_date || b.created_at || ''));
  });

  var totalPaidToDate = 0;
  allReceiptsForInv.forEach(function(r) {
    totalPaidToDate += Number(r.amount || 0);
  });
  if (allReceiptsForInv.length === 0) {
    totalPaidToDate = Number(receipt.amount || 0);
  }

  var balRemaining = Math.max(0, invTotal - totalPaidToDate);

  // Read company details from the invoice snapshot (most reliable — saved at invoice time),
  // falling back to current generator form values, then to hardcoded defaults.
  var snapForm = (inv && inv.snapshot && inv.snapshot.form) ? inv.snapshot.form : {};
  var coName     = snapForm.coName     || gv('coName')     || 'Event Media Production';
  var coEmail    = snapForm.coEmail    || gv('coEmail')    || 'eventmediap@gmail.com';
  var coPhone    = snapForm.coPhone    || gv('coPhone')    || '+94 777486548 | +94 752878875';
  var coAddr     = snapForm.coAddr     || gv('coAddr')     || '485/A, Weera Mw, Depanama, Pannipitiya';
  var coInstagram = ((snapForm.coInstagram || gv('coInstagram') || '')).trim();
  var coWebsite   = ((snapForm.coWebsite   || gv('coWebsite')   || '')).trim();
  var coAddrLine = (coAddr || '').replace(/\n/g, ' &middot; ');
  var accent = (typeof window.accent !== 'undefined' && window.accent) || gv('colorAccent') || gv('accentColor') || '#e11d48';

  var logoHtml = LOGO_DATA
    ? '<img src="' + LOGO_DATA + '" style="height:68px;max-width:170px;object-fit:contain;margin-right:12px" alt="Logo">'
    : '<div style="font-size:22px;font-weight:800;color:' + accent + ';letter-spacing:0.5px;margin-right:12px">' + esc(coName) + '</div>';

  var receiptHtml =
    '<div id="receiptPrintableDoc" class="receipt-doc-paper">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:1.2rem;margin-bottom:1.5rem">' +
        '<div style="display:flex;align-items:center">' +
          logoHtml +
          '<div>' +
            '<div class="doc-company-name" style="color:' + accent + ';font-size:16px;font-weight:800;letter-spacing:0.3px">' + esc(coName) + '</div>' +
            '<div style="font-size:11.5px;color:#64748b;margin-top:2px">' + esc(coEmail) + ' &nbsp;&middot;&nbsp; ' + esc(coPhone) + '</div>' +
            ((coInstagram || coWebsite) ?
              '<div style="font-size:11px;color:#64748b;margin-top:2px">' + [coInstagram, coWebsite].filter(Boolean).map(esc).join(' &nbsp;&middot;&nbsp; ') + '</div>' : '') +
            '<div style="font-size:11px;color:#64748b;margin-top:2px">' + esc(coAddrLine) + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="text-align:right">' +
          '<div class="receipt-badge">OFFICIAL RECEIPT</div>' +
          '<div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:4px">' + esc(receipt.receipt_no) + '</div>' +
          '<div style="font-size:12px;color:#64748b;margin-top:2px">Date: <strong>' + managerDate(receipt.payment_date) + '</strong></div>' +
        '</div>' +
      '</div>' +

      '<div class="receipt-summary-grid">' +
        '<div class="receipt-summary-col">' +
          '<div class="receipt-col-label">RECEIVED FROM</div>' +
          '<div class="receipt-col-val">' + esc(receipt.client_name || (inv ? inv.client_name : '—')) + '</div>' +
          (receipt.event_name ? '<div style="font-size:12px;color:#64748b;margin-top:3px"><i class="ti ti-calendar-event"></i> ' + esc(receipt.event_name) + '</div>' : '') +
        '</div>' +
        '<div class="receipt-summary-col">' +
          '<div class="receipt-col-label">PAYMENT METHOD</div>' +
          '<div class="receipt-col-val">' + esc(receipt.payment_method || 'Bank Transfer') + '</div>' +
          (receipt.reference_no ? '<div style="font-size:12px;color:#64748b;margin-top:3px">Ref: <strong>' + esc(receipt.reference_no) + '</strong></div>' : '') +
        '</div>' +
      '</div>' +

      '<div class="receipt-amount-card">' +
        '<div class="receipt-amount-label">AMOUNT RECEIVED</div>' +
        '<div class="receipt-amount-value">' + managerMoney(receipt.amount, currency) + '</div>' +
        '<div style="font-size:12px;color:#0369a1;margin-top:4px;font-weight:500">Payment received with thanks.</div>' +
      '</div>' +

      '<div style="margin-top:1.5rem">' +
        '<div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Invoice Payment Breakdown</div>' +
        '<table class="receipt-table">' +
          '<thead>' +
            '<tr>' +
              '<th>Invoice Reference</th>' +
              '<th style="text-align:right">Invoice Total</th>' +
              '<th style="text-align:right">Total Paid To Date</th>' +
              '<th style="text-align:right">This Receipt</th>' +
              '<th style="text-align:right">Remaining Balance</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            '<tr>' +
              '<td>' +
                '<strong>' + esc(inv ? inv.doc_number : 'Direct Payment') + '</strong>' +
                (inv && inv.issue_date ? '<div style="font-size:11px;color:#64748b">Issued: ' + managerDate(inv.issue_date) + '</div>' : '') +
              '</td>' +
              '<td style="text-align:right">' + managerMoney(invTotal, currency) + '</td>' +
              '<td style="text-align:right">' + managerMoney(totalPaidToDate, currency) + '</td>' +
              '<td style="text-align:right;font-weight:700;color:#0284c7">' + managerMoney(receipt.amount, currency) + '</td>' +
              '<td style="text-align:right;font-weight:700;color:' + (balRemaining > 0 ? '#ea580c' : '#16a34a') + '">' + managerMoney(balRemaining, currency) + '</td>' +
            '</tr>' +
          '</tbody>' +
        '</table>' +
      '</div>' +

      ((receipt.bank_account || receipt.notes) ?
        '<div style="margin-top:1.2rem;padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;color:#475569;line-height:1.5">' +
          (receipt.bank_account ? '<div><strong>Bank Account:</strong> ' + esc(receipt.bank_account) + '</div>' : '') +
          (receipt.notes ? '<div style="margin-top:2px"><strong>Remarks:</strong> ' + esc(receipt.notes) + '</div>' : '') +
        '</div>' : '') +

      '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:2.5rem;padding-top:1.5rem;border-top:1px dashed #cbd5e1">' +
        '<div style="font-size:11px;color:#94a3b8;max-width:320px;line-height:1.4">' +
          'This is a computer-generated official receipt issued by ' + esc(coName) + '. For inquiries, please contact ' + esc(coEmail) + '.' +
        '</div>' +
        '<div style="text-align:center">' +
          (SIG_SASINDU ? '<img src="' + SIG_SASINDU + '" style="height:48px;max-width:140px;object-fit:contain;margin-bottom:2px" alt="Authorized Signature">' : '<div style="height:48px"></div>') +
          '<div style="border-top:1px solid #475569;width:160px;margin:0 auto"></div>' +
          '<div style="font-size:11.5px;font-weight:700;color:#1e293b;margin-top:4px">Authorized Signature</div>' +
          '<div style="font-size:10.5px;color:#64748b">' + esc(coName) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  var container = document.getElementById('receiptDocContainer');
  if (container) container.innerHTML = receiptHtml;

  var titleEl = document.getElementById('receiptDocToolbarTitle');
  if (titleEl) titleEl.textContent = 'Payment Receipt — ' + receipt.receipt_no;

  document.getElementById('receiptDocModal').classList.add('open');
}

function closeReceiptDocModal() {
  document.getElementById('receiptDocModal').classList.remove('open');
}

function printPaymentReceipt() {
  printWithMode('print-receipt');
}
// Applies a body class for the duration of one print job so print CSS can
// target exactly what should come out of the printer.
function printWithMode(cls, targetEl) {
  flushRender();
  document.body.classList.add(cls);
  if (targetEl) targetEl.classList.add('print-target');
  var done = function() {
    document.body.classList.remove(cls);
    if (targetEl) targetEl.classList.remove('print-target');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
  // Some mobile browsers never fire afterprint and print asynchronously. The
  // class only affects print styles, so a generous fallback is harmless.
  setTimeout(done, 60000);
}
function printDocument() { printWithMode('print-doc'); }
function printSection(el) { if (typeof el === 'string') el = document.getElementById(el); if (el) printWithMode('print-section', el); }

function downloadPaymentReceiptPNG() {
  if (!exportLibsReady(false)) return;
  var el = document.getElementById('receiptPrintableDoc');
  if (!el) { alert('Receipt not ready.'); return; }
  var rNo = CURRENT_VIEWING_RECEIPT ? CURRENT_VIEWING_RECEIPT.receipt_no : 'receipt';
  var lockWidth = el.getBoundingClientRect().width;
  captureInvoiceCanvas(el, 1, lockWidth, '').then(function(canvas) {
    var a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = rNo + '.png';
    a.click();
  }).catch(function(e){ alert('Receipt PNG download failed: ' + e.message); });
}

function downloadPaymentReceiptPDF() {
  if (!exportLibsReady(true)) return;
  var el = document.getElementById('receiptPrintableDoc');
  if (!el) { alert('Receipt not ready.'); return; }
  var rNo = CURRENT_VIEWING_RECEIPT ? CURRENT_VIEWING_RECEIPT.receipt_no : 'receipt';
  var btn = document.getElementById('receiptPdfBtn');
  var origText = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '<i class="ti ti-loader"></i> Generating...'; btn.disabled = true; }

  var lockWidth = el.getBoundingClientRect().width;
  captureInvoiceCanvas(el, 1, lockWidth, '').then(function(canvas) {
    var pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageW = pdf.internal.pageSize.getWidth();
    var pageH = pdf.internal.pageSize.getHeight();
    var marginX = 12, marginY = 12;
    var imgW = pageW - marginX * 2;
    var maxImgH = pageH - marginY * 2;
    var imgData = canvas.toDataURL('image/jpeg', 0.95);
    var w = imgW, h = (canvas.height / canvas.width) * imgW;
    if (h > maxImgH) { w = w * (maxImgH / h); h = maxImgH; }
    pdf.addImage(imgData, 'JPEG', marginX + (imgW - w) / 2, marginY, w, h);
    pdf.save(rNo + '.pdf');
  }).catch(function(e) {
    alert('Receipt PDF failed: ' + e.message);
  }).finally(function() {
    if (btn) { btn.innerHTML = origText; btn.disabled = false; }
  });
}

var CURRENT_HISTORY_INVOICE_ID = null;

function openInvoiceHistory(invoiceId) {
  var inv = (managerState.invoices || []).find(function(x) { return x.id === invoiceId; });
  if (!inv) { alert('Invoice not found.'); return; }
  CURRENT_HISTORY_INVOICE_ID = invoiceId;

  var total = Number(inv.grand_total || 0);
  var receipts = (managerState.paymentReceipts || []).filter(function(r) { return r.invoice_id === invoiceId; });
  var paid = invoicePaidAmount(inv);
  var bal = Math.max(0, total - paid);
  var st = invoiceStatus(inv);

  document.getElementById('invoiceHistoryTitle').textContent = 'Payment History — ' + inv.doc_number;
  document.getElementById('invoiceHistorySub').textContent = 'Client: ' + (inv.client_name || '—') + (inv.event_name ? ' · Event: ' + inv.event_name : '');

  var addBtn = document.getElementById('invoiceHistoryAddPaymentBtn');
  if (addBtn) {
    addBtn.style.display = (bal > 0) ? '' : 'none';
  }

  var listHtml = '';
  if (receipts.length === 0) {
    var legacy = (managerState.payments || []).filter(function(p) { return p.invoice_id === invoiceId; });
    if (legacy.length > 0) {
      listHtml = '<div style="margin-bottom:.8rem;font-size:12px;color:var(--text3)">Legacy recorded payments:</div>' +
        '<table class="manager-table" style="width:100%"><thead><tr><th>Date</th><th>Method</th><th>Ref</th><th>Amount</th></tr></thead><tbody>' +
        legacy.map(function(p) {
          return '<tr><td>' + managerDate(p.payment_date) + '</td><td>' + esc(p.method || '—') + '</td><td>' + esc(p.reference || '—') + '</td><td class="manager-money">' + managerMoney(p.amount, inv.currency) + '</td></tr>';
        }).join('') + '</tbody></table>';
    } else {
      listHtml = '<div class="manager-empty">No payments received for this invoice yet. Click "Add Payment" to record a payment.</div>';
    }
  } else {
    listHtml = '<table class="manager-table" style="width:100%"><thead><tr>' +
      '<th>Receipt #</th>' +
      '<th>Date</th>' +
      '<th>Method & Ref</th>' +
      '<th>Notes</th>' +
      '<th style="text-align:right">Amount Received</th>' +
      '<th style="text-align:right">Actions</th>' +
      '</tr></thead><tbody>' +
      receipts.map(function(r) {
        return '<tr>' +
          '<td><strong style="color:var(--accent);cursor:pointer" onclick="viewPaymentReceiptDoc(\'' + r.id + '\')" title="View Receipt">' + esc(r.receipt_no) + '</strong></td>' +
          '<td>' + managerDate(r.payment_date) + '</td>' +
          '<td>' + esc(r.payment_method || '—') + (r.reference_no ? '<div style="font-size:11px;color:var(--text3)">Ref: ' + esc(r.reference_no) + '</div>' : '') + '</td>' +
          '<td>' + esc(r.notes || '—') + '</td>' +
          '<td class="manager-money" style="font-weight:700;color:var(--accent)">' + managerMoney(r.amount, inv.currency) + '</td>' +
          '<td style="text-align:right;white-space:nowrap">' +
            '<button class="btn btn-sm btn-primary" onclick="viewPaymentReceiptDoc(\'' + r.id + '\')"><i class="ti ti-eye"></i> Receipt</button> ' +
            '<button class="btn btn-sm" onclick="closeInvoiceHistoryModal();editPaymentReceipt(\'' + r.id + '\')"><i class="ti ti-edit"></i></button>' +
          '</td>' +
        '</tr>';
      }).join('') + '</tbody></table>';
  }

  var bodyEl = document.getElementById('invoiceHistoryBody');
  if (bodyEl) {
    bodyEl.innerHTML =
      '<div class="receipt-balance-cards" style="margin-bottom:1.2rem">' +
        '<div class="receipt-balance-card"><div class="balance-card-label">Invoice Total</div><div class="balance-card-val">' + managerMoney(total, inv.currency) + '</div></div>' +
        '<div class="receipt-balance-card"><div class="balance-card-label">Total Paid</div><div class="balance-card-val" style="color:#16a34a">' + managerMoney(paid, inv.currency) + '</div></div>' +
        '<div class="receipt-balance-card highlight"><div class="balance-card-label">Balance Due</div><div class="balance-card-val" style="color:' + (bal > 0 ? '#ea580c' : '#16a34a') + '">' + managerMoney(bal, inv.currency) + '</div></div>' +
        '<div class="receipt-balance-card"><div class="balance-card-label">Status</div><div class="balance-card-val" style="font-size:13px">' + statusBadge(st) + '</div></div>' +
      '</div>' +
      listHtml;
  }

  document.getElementById('invoiceHistoryModal').classList.add('open');
}

function closeInvoiceHistoryModal() {
  document.getElementById('invoiceHistoryModal').classList.remove('open');
}

function openPaymentFromHistory() {
  var id = CURRENT_HISTORY_INVOICE_ID;
  closeInvoiceHistoryModal();
  if (id) {
    openPaymentReceiptModal({ invoiceId: id });
  }
}

// Legacy Payment Modal fallback
function openPaymentModal(id){
  openPaymentReceiptModal({ invoiceId: id });
}
function closePaymentModal(){ closePaymentReceiptModal(); }
async function saveInvoicePayment(){ await savePaymentReceipt(); }
function resetRentalForm(){['rentalEditId','rentalSupplier','rentalEvent','rentalItem','rentalReturnDate','rentalContact','rentalNotes'].forEach(function(id){document.getElementById(id).value='';});document.getElementById('rentalQty').value='1';document.getElementById('rentalDate').value=managerToday();document.getElementById('rentalAmount').value='0';document.getElementById('rentalPaid').value='0';document.getElementById('rentalStatus').value='booked';document.getElementById('rentalFormTitle').textContent='Add supplier rental';document.getElementById('rentalSaveBtn').innerHTML='<i class="ti ti-device-floppy"></i> Save rental';}
async function saveRental(){
  var id=gv('rentalEditId'), supplier=gv('rentalSupplier').trim(), item=gv('rentalItem').trim(), date=gv('rentalDate'); if(!supplier||!item||!date){alert('Supplier, equipment/service and rental date are required.');return;}
  var payload={workspace_id:gv('sbWorkspace').trim(),supplier_name:supplier,supplier_contact:gv('rentalContact').trim(),event_name:gv('rentalEvent').trim(),item_description:item,quantity:Number(gv('rentalQty')||1),rent_date:date,return_date:gv('rentalReturnDate')||null,amount:Number(gv('rentalAmount')||0),amount_paid:Number(gv('rentalPaid')||0),status:gv('rentalStatus')||'booked',notes:gv('rentalNotes').trim(),updated_at:new Date().toISOString()};
  try{var url=sbBase()+'/rest/v1/equipment_rentals'+(id?'?id=eq.'+encodeURIComponent(id):'');var method=id?'PATCH':'POST';var h=sbHeaders(gv('sbKey').trim(),{'Prefer':'return=representation'});var r=await fetch(url,{method:method,headers:h,body:JSON.stringify(payload)});if(!r.ok){var tx=await r.text();throw new Error(tx);}resetRentalForm();await loadManagerData();}
  catch(e){console.error(e);alert('Could not save rental. Run the manager setup SQL if needed. '+e.message);}
}
function editRental(id){var r=managerState.rentals.find(function(x){return x.id===id;});if(!r)return;document.getElementById('rentalEditId').value=r.id;document.getElementById('rentalSupplier').value=r.supplier_name||'';document.getElementById('rentalContact').value=r.supplier_contact||'';document.getElementById('rentalEvent').value=r.event_name||'';document.getElementById('rentalItem').value=r.item_description||'';document.getElementById('rentalQty').value=r.quantity||1;document.getElementById('rentalDate').value=r.rent_date||'';document.getElementById('rentalReturnDate').value=r.return_date||'';document.getElementById('rentalAmount').value=r.amount||0;document.getElementById('rentalPaid').value=r.amount_paid||0;document.getElementById('rentalStatus').value=r.status||'booked';document.getElementById('rentalNotes').value=r.notes||'';document.getElementById('rentalFormTitle').textContent='Edit supplier rental';document.getElementById('rentalSaveBtn').innerHTML='<i class="ti ti-device-floppy"></i> Update rental';window.scrollTo({top:0,behavior:'smooth'});}
async function deleteRental(id){if(!confirm('Delete this rental record?'))return;try{var r=await fetch(sbBase()+'/rest/v1/equipment_rentals?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:sbHeaders(gv('sbKey').trim())});if(!r.ok)throw new Error(await r.text());await loadManagerData();}catch(e){alert('Could not delete rental: '+e.message);}}
async function quickRentalStatus(id,st){try{var r=await fetch(sbBase()+'/rest/v1/equipment_rentals?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:sbHeaders(gv('sbKey').trim()),body:JSON.stringify({status:st,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error(await r.text());var row=managerState.rentals.find(function(x){return x.id===id;});if(row)row.status=st;renderManagerAll();}catch(e){alert('Could not update status: '+e.message);}}
function renderRentals(){var wrap=document.getElementById('managerRentalTable');if(!wrap)return;var q=(gv('managerRentalSearch')||'').toLowerCase(),fs=gv('managerRentalStatus')||'all';var rows=managerState.rentals.filter(function(r){var hay=[r.supplier_name,r.item_description,r.event_name].join(' ').toLowerCase();return(!q||hay.indexOf(q)>=0)&&(fs==='all'||r.status===fs);}).sort(function(a,b){return String(b.rent_date||'').localeCompare(String(a.rent_date||''));});if(!rows.length){wrap.innerHTML='<div class="manager-empty">No supplier rentals yet.</div>';return;}wrap.innerHTML='<div class="manager-table-wrap"><table class="manager-table"><thead><tr><th>Supplier</th><th>Equipment / Event</th><th>Rental date</th><th>Return</th><th>Cost</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+rows.map(function(r){var bal=Math.max(0,Number(r.amount||0)-Number(r.amount_paid||0));return '<tr><td><strong>'+esc(r.supplier_name)+'</strong>'+(r.supplier_contact?'<div style="font-size:11px;color:var(--text3)">'+esc(r.supplier_contact)+'</div>':'')+'</td><td>'+esc(r.item_description)+(r.event_name?'<div style="font-size:11px;color:var(--text3)">'+esc(r.event_name)+'</div>':'')+'</td><td>'+managerDate(r.rent_date)+'</td><td>'+managerDate(r.return_date)+'</td><td class="manager-money">'+managerMoney(r.amount)+'</td><td class="manager-money">'+managerMoney(r.amount_paid)+'</td><td class="manager-money">'+managerMoney(bal)+'</td><td><select style="padding:5px 7px;border:1px solid var(--border2);border-radius:7px;background:var(--surface);color:var(--text);font-size:11px" onchange="quickRentalStatus(\''+r.id+'\',this.value)">'+['booked','picked_up','returned','paid','cancelled'].map(function(x){return '<option value="'+x+'" '+(r.status===x?'selected':'')+'>'+x.replace('_',' ')+'</option>';}).join('')+'</select></td><td style="white-space:nowrap"><button class="btn btn-sm" onclick="editRental(\''+r.id+'\')">Edit</button> <button class="btn btn-sm" style="color:#dc2626" onclick="deleteRental(\''+r.id+'\')">Delete</button></td></tr>';}).join('')+'</tbody></table></div>';}


function equipmentHirePaymentStatus(h){var total=Number(h.amount||0),paid=Number(h.amount_paid||0);if(total>0&&paid>=total-0.005)return'paid';if(paid>0)return'partial';return'unpaid';}
function resetEquipmentHireForm(){['equipmentHireEditId','equipmentHireCustomer','equipmentHireContact','equipmentHireItem','equipmentHireEvent','equipmentHireReturnDate','equipmentHireReference','equipmentHireNotes'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});if(document.getElementById('equipmentHireQty'))document.getElementById('equipmentHireQty').value='1';if(document.getElementById('equipmentHireDate'))document.getElementById('equipmentHireDate').value=managerToday();if(document.getElementById('equipmentHireStatus'))document.getElementById('equipmentHireStatus').value='booked';if(document.getElementById('equipmentHireAmount'))document.getElementById('equipmentHireAmount').value='0';if(document.getElementById('equipmentHirePaid'))document.getElementById('equipmentHirePaid').value='0';if(document.getElementById('equipmentHireMethod'))document.getElementById('equipmentHireMethod').value='Bank Transfer';if(document.getElementById('equipmentHireFormTitle'))document.getElementById('equipmentHireFormTitle').textContent='Rent out our equipment';if(document.getElementById('equipmentHireSaveBtn'))document.getElementById('equipmentHireSaveBtn').innerHTML='<i class="ti ti-device-floppy"></i> Save equipment hire';}
async function saveEquipmentHire(){var id=gv('equipmentHireEditId'),customer=gv('equipmentHireCustomer').trim(),item=gv('equipmentHireItem').trim(),date=gv('equipmentHireDate'),amount=Number(gv('equipmentHireAmount')||0),paid=Number(gv('equipmentHirePaid')||0);if(!customer||!item||!date||amount<=0){alert('Customer, equipment, hire date and a hire charge greater than 0 are required.');return;}var payStatus=paid>=amount-0.005?'paid':(paid>0?'partial':'unpaid');var payload={workspace_id:gv('sbWorkspace').trim(),customer_name:customer,customer_contact:gv('equipmentHireContact').trim(),event_name:gv('equipmentHireEvent').trim(),item_description:item,quantity:Number(gv('equipmentHireQty')||1),hire_date:date,return_date:gv('equipmentHireReturnDate')||null,amount:amount,amount_paid:paid,payment_status:payStatus,hire_status:gv('equipmentHireStatus')||'booked',payment_method:gv('equipmentHireMethod')||'',reference:gv('equipmentHireReference').trim(),notes:gv('equipmentHireNotes').trim(),updated_at:new Date().toISOString()};try{var url=sbBase()+'/rest/v1/owned_equipment_hires'+(id?'?id=eq.'+encodeURIComponent(id):'');var r=await fetch(url,{method:id?'PATCH':'POST',headers:sbHeaders(gv('sbKey').trim(),{'Prefer':'return=representation'}),body:JSON.stringify(payload)});if(!r.ok)throw new Error(await r.text());resetEquipmentHireForm();await loadManagerData();}catch(e){alert('Could not save equipment hire. Run the updated setup SQL first. '+e.message);}}
function editEquipmentHire(id){var h=managerState.equipmentHires.find(function(x){return x.id===id;});if(!h)return;document.getElementById('equipmentHireEditId').value=h.id;document.getElementById('equipmentHireCustomer').value=h.customer_name||'';document.getElementById('equipmentHireContact').value=h.customer_contact||'';document.getElementById('equipmentHireItem').value=h.item_description||'';document.getElementById('equipmentHireQty').value=h.quantity||1;document.getElementById('equipmentHireEvent').value=h.event_name||'';document.getElementById('equipmentHireDate').value=h.hire_date||'';document.getElementById('equipmentHireReturnDate').value=h.return_date||'';document.getElementById('equipmentHireStatus').value=h.hire_status||'booked';document.getElementById('equipmentHireAmount').value=h.amount||0;document.getElementById('equipmentHirePaid').value=h.amount_paid||0;document.getElementById('equipmentHireMethod').value=h.payment_method||'Other';document.getElementById('equipmentHireReference').value=h.reference||'';document.getElementById('equipmentHireNotes').value=h.notes||'';document.getElementById('equipmentHireFormTitle').textContent='Edit equipment hire';document.getElementById('equipmentHireSaveBtn').innerHTML='<i class="ti ti-device-floppy"></i> Update equipment hire';window.scrollTo({top:0,behavior:'smooth'});}
async function deleteEquipmentHire(id){if(!confirm('Delete this equipment-hire record?'))return;try{var r=await fetch(sbBase()+'/rest/v1/owned_equipment_hires?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:sbHeaders(gv('sbKey').trim())});if(!r.ok)throw new Error(await r.text());await loadManagerData();}catch(e){alert('Could not delete equipment hire: '+e.message);}}
async function quickEquipmentHireStatus(id,st){try{var r=await fetch(sbBase()+'/rest/v1/owned_equipment_hires?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:sbHeaders(gv('sbKey').trim()),body:JSON.stringify({hire_status:st,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error(await r.text());var row=managerState.equipmentHires.find(function(x){return x.id===id;});if(row)row.hire_status=st;renderManagerAll();}catch(e){alert('Could not update hire status: '+e.message);}}
function renderEquipmentHires(){var wrap=document.getElementById('equipmentHireTable'),metrics=document.getElementById('equipmentHireMetrics');if(!wrap)return;var q=(gv('equipmentHireSearch')||'').toLowerCase(),hs=gv('equipmentHireFilter')||'all',ps=gv('equipmentHirePaymentFilter')||'all';var all=managerState.equipmentHires.filter(function(h){return h.hire_status!=='cancelled';});var total=all.reduce(function(a,h){return a+Number(h.amount||0);},0),received=all.reduce(function(a,h){return a+Number(h.amount_paid||0);},0),outstanding=Math.max(0,total-received),outCount=all.filter(function(h){return h.hire_status==='out';}).length;if(metrics)metrics.innerHTML='<div class="metric-card"><div class="metric-label">Equipment Hire Revenue</div><div class="metric-value">'+managerMoney(total)+'</div><div class="metric-note">Non-invoice hire charges</div></div><div class="metric-card"><div class="metric-label">Received</div><div class="metric-value">'+managerMoney(received)+'</div><div class="metric-note">Cash collected from hires</div></div><div class="metric-card"><div class="metric-label">Outstanding</div><div class="metric-value">'+managerMoney(outstanding)+'</div><div class="metric-note">Still to collect</div></div><div class="metric-card"><div class="metric-label">Equipment Out</div><div class="metric-value">'+outCount+'</div><div class="metric-note">Current hire record(s)</div></div>';var rows=managerState.equipmentHires.filter(function(h){var pay=equipmentHirePaymentStatus(h),hay=[h.customer_name,h.customer_contact,h.item_description,h.event_name,h.reference].join(' ').toLowerCase();return(!q||hay.indexOf(q)>=0)&&(hs==='all'||h.hire_status===hs)&&(ps==='all'||pay===ps);}).sort(function(a,b){return String(b.hire_date||'').localeCompare(String(a.hire_date||''));});if(!rows.length){wrap.innerHTML='<div class="manager-empty">No equipment hires match this view.</div>';return;}wrap.innerHTML='<div class="manager-table-wrap"><table class="manager-table" style="min-width:1100px"><thead><tr><th>Customer</th><th>Our equipment / Event</th><th>Hire date</th><th>Return</th><th>Charge</th><th>Received</th><th>Balance</th><th>Payment</th><th>Hire status</th><th>Actions</th></tr></thead><tbody>'+rows.map(function(h){var t=Number(h.amount||0),p=Number(h.amount_paid||0),bal=Math.max(0,t-p),pay=equipmentHirePaymentStatus(h);return '<tr><td><strong>'+esc(h.customer_name)+'</strong>'+(h.customer_contact?'<div style="font-size:11px;color:var(--text3)">'+esc(h.customer_contact)+'</div>':'')+'</td><td>'+esc(h.item_description)+(h.event_name?'<div style="font-size:11px;color:var(--text3)">'+esc(h.event_name)+'</div>':'')+'</td><td>'+managerDate(h.hire_date)+'</td><td>'+managerDate(h.return_date)+'</td><td class="manager-money">'+managerMoney(t)+'</td><td class="manager-money">'+managerMoney(p)+'</td><td class="manager-money">'+managerMoney(bal)+'</td><td>'+statusBadge(pay)+'</td><td><select style="padding:5px 7px;border:1px solid var(--border2);border-radius:7px;background:var(--surface);color:var(--text);font-size:11px" onchange="quickEquipmentHireStatus(\''+h.id+'\',this.value)">'+['booked','out','returned','cancelled'].map(function(x){return '<option value="'+x+'" '+(h.hire_status===x?'selected':'')+'>'+x.replace('_',' ')+'</option>';}).join('')+'</select></td><td style="white-space:nowrap"><button class="btn btn-sm" onclick="editEquipmentHire(\''+h.id+'\')">Edit</button> <button class="btn btn-sm" style="color:#dc2626" onclick="deleteEquipmentHire(\''+h.id+'\')">Delete</button></td></tr>';}).join('')+'</tbody></table></div>';}

function onFinancePeriodChange(){
  var mode=gv('financePeriod')||'all', m=document.getElementById('financeMonth');
  if(m){m.style.display=mode==='month'?'':'none'; if(mode==='month'&&!m.value)m.value=localISOMonth();}
  renderFinance(); renderExpenses();
}
function financeInPeriod(dateValue){
  var mode=gv('financePeriod')||'all'; if(mode!=='month') return true;
  var month=gv('financeMonth')||localISOMonth();
  return String(dateValue||'').slice(0,7)===month;
}
function renderFinance(){
  var metrics=document.getElementById('financeMetrics'); if(!metrics)return;
  var inv=managerState.invoices.filter(function(x){return financeInPeriod(x.issue_date||x.created_at);});
  var rents=managerState.rentals.filter(function(r){return r.status!=='cancelled'&&financeInPeriod(r.rent_date||r.created_at);});
  var exps=managerState.expenses.filter(function(e){return financeInPeriod(e.expense_date||e.created_at);});
  var hires=managerState.equipmentHires.filter(function(h){return h.hire_status!=='cancelled'&&financeInPeriod(h.hire_date||h.created_at);});
  var invoiceRevenue=inv.reduce(function(a,x){return a+Number(x.grand_total||0);},0);
  var equipmentHireRevenue=hires.reduce(function(a,h){return a+Number(h.amount||0);},0);
  var revenue=invoiceRevenue+equipmentHireRevenue;
  var rentalExpenses=rents.reduce(function(a,r){return a+Number(r.amount||0);},0);
  var otherExpenses=exps.reduce(function(a,e){return a+Number(e.amount||0);},0);
  var netProfit=revenue-rentalExpenses-otherExpenses;
  metrics.innerHTML=
    '<div class="metric-card"><div class="metric-label">Total Revenue</div><div class="metric-value">'+managerMoney(revenue)+'</div><div class="metric-note">'+managerMoney(invoiceRevenue)+' invoices + '+managerMoney(equipmentHireRevenue)+' equipment hires</div></div>'+ 
    '<div class="metric-card"><div class="metric-label">Rental Expenses</div><div class="metric-value">'+managerMoney(rentalExpenses)+'</div><div class="metric-note">'+rents.length+' active rental(s)</div></div>'+ 
    '<div class="metric-card"><div class="metric-label">Other Expenses</div><div class="metric-value">'+managerMoney(otherExpenses)+'</div><div class="metric-note">'+exps.length+' expense(s)</div></div>'+ 
    '<div class="metric-card"><div class="metric-label">Net Profit</div><div class="metric-value">'+managerMoney(netProfit)+'</div><div class="metric-note">Revenue − rentals − other expenses</div></div>';
  var f=document.getElementById('financeFormula'); if(f){var label=(gv('financePeriod')==='month'?(gv('financeMonth')||'Selected month'):'All time');f.innerHTML='<strong>'+esc(label)+'</strong>: '+managerMoney(invoiceRevenue)+' invoice revenue + '+managerMoney(equipmentHireRevenue)+' equipment-hire revenue − '+managerMoney(rentalExpenses)+' supplier rentals − '+managerMoney(otherExpenses)+' other expenses = <strong>'+managerMoney(netProfit)+'</strong> net profit.';}
}
function resetExpenseForm(){
  ['expenseEditId','expenseDescription','expenseEvent','expenseReference','expenseNotes'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  if(document.getElementById('expenseDate'))document.getElementById('expenseDate').value=managerToday();
  if(document.getElementById('expenseCategory'))document.getElementById('expenseCategory').value='Transport';
  if(document.getElementById('expenseAmount'))document.getElementById('expenseAmount').value='0';
  if(document.getElementById('expenseMethod'))document.getElementById('expenseMethod').value='Bank Transfer';
  if(document.getElementById('expenseFormTitle'))document.getElementById('expenseFormTitle').textContent='Add other expense';
  if(document.getElementById('expenseSaveBtn'))document.getElementById('expenseSaveBtn').innerHTML='<i class="ti ti-device-floppy"></i> Save expense';
}
async function saveExpense(){
  var id=gv('expenseEditId'), desc=gv('expenseDescription').trim(), date=gv('expenseDate'), amount=Number(gv('expenseAmount')||0);
  if(!desc||!date||amount<=0){alert('Date, description and an amount greater than 0 are required.');return;}
  var payload={workspace_id:gv('sbWorkspace').trim(),expense_date:date,category:gv('expenseCategory')||'Other',description:desc,event_name:gv('expenseEvent').trim(),amount:amount,payment_method:gv('expenseMethod')||'',reference:gv('expenseReference').trim(),notes:gv('expenseNotes').trim(),updated_at:new Date().toISOString()};
  try{var url=sbBase()+'/rest/v1/other_expenses'+(id?'?id=eq.'+encodeURIComponent(id):'');var method=id?'PATCH':'POST';var h=sbHeaders(gv('sbKey').trim(),{'Prefer':'return=representation'});var r=await fetch(url,{method:method,headers:h,body:JSON.stringify(payload)});if(!r.ok)throw new Error(await r.text());resetExpenseForm();await loadManagerData();}
  catch(e){console.error(e);alert('Could not save expense. Run the updated manager setup SQL first. '+e.message);}
}
function editExpense(id){var e=managerState.expenses.find(function(x){return x.id===id;});if(!e)return;document.getElementById('expenseEditId').value=e.id;document.getElementById('expenseDate').value=e.expense_date||'';document.getElementById('expenseCategory').value=e.category||'Other';document.getElementById('expenseDescription').value=e.description||'';document.getElementById('expenseEvent').value=e.event_name||'';document.getElementById('expenseAmount').value=e.amount||0;document.getElementById('expenseMethod').value=e.payment_method||'Other';document.getElementById('expenseReference').value=e.reference||'';document.getElementById('expenseNotes').value=e.notes||'';document.getElementById('expenseFormTitle').textContent='Edit other expense';document.getElementById('expenseSaveBtn').innerHTML='<i class="ti ti-device-floppy"></i> Update expense';window.scrollTo({top:0,behavior:'smooth'});}
async function deleteExpense(id){if(!confirm('Delete this expense record?'))return;try{var r=await fetch(sbBase()+'/rest/v1/other_expenses?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:sbHeaders(gv('sbKey').trim())});if(!r.ok)throw new Error(await r.text());await loadManagerData();}catch(e){alert('Could not delete expense: '+e.message);}}
function renderExpenses(){
  var wrap=document.getElementById('managerExpenseTable'); if(!wrap)return;
  var q=(gv('managerExpenseSearch')||'').toLowerCase(), cat=gv('managerExpenseCategory')||'all';
  var rows=managerState.expenses.filter(function(e){var hay=[e.description,e.category,e.event_name,e.reference].join(' ').toLowerCase();return(!q||hay.indexOf(q)>=0)&&(cat==='all'||e.category===cat)&&financeInPeriod(e.expense_date||e.created_at);}).sort(function(a,b){return String(b.expense_date||'').localeCompare(String(a.expense_date||''));});
  if(!rows.length){wrap.innerHTML='<div class="manager-empty">No other expenses recorded for this view.</div>';return;}
  wrap.innerHTML='<div class="manager-table-wrap"><table class="manager-table" style="min-width:850px"><thead><tr><th>Date</th><th>Category</th><th>Description / Event</th><th>Method</th><th>Reference</th><th>Amount</th><th>Actions</th></tr></thead><tbody>'+rows.map(function(e){return '<tr><td>'+managerDate(e.expense_date)+'</td><td><strong>'+esc(e.category||'Other')+'</strong></td><td>'+esc(e.description)+(e.event_name?'<div style="font-size:11px;color:var(--text3)">'+esc(e.event_name)+'</div>':'')+'</td><td>'+esc(e.payment_method||'—')+'</td><td>'+esc(e.reference||'—')+'</td><td class="manager-money">'+managerMoney(e.amount)+'</td><td style="white-space:nowrap"><button class="btn btn-sm" onclick="editExpense(\''+e.id+'\')">Edit</button> <button class="btn btn-sm" style="color:#dc2626" onclick="deleteExpense(\''+e.id+'\')">Delete</button></td></tr>';}).join('')+'</tbody></table></div>';
}

function renderReports(){
  var month=gv('reportMonth')||localISOMonth();
  var inv=managerState.invoices.filter(function(x){return String(x.issue_date||x.created_at||'').slice(0,7)===month;});
  var pays=(managerState.paymentReceipts&&managerState.paymentReceipts.length>0)?managerState.paymentReceipts.filter(function(p){return String(p.payment_date||'').slice(0,7)===month;}):(managerState.payments||[]).filter(function(p){return String(p.payment_date||'').slice(0,7)===month;});
  var rents=managerState.rentals.filter(function(r){return String(r.rent_date||'').slice(0,7)===month&&r.status!=='cancelled';});
  var hires=managerState.equipmentHires.filter(function(h){return String(h.hire_date||'').slice(0,7)===month&&h.hire_status!=='cancelled';});
  var exps=managerState.expenses.filter(function(e){return String(e.expense_date||'').slice(0,7)===month;});
  var billed=inv.reduce(function(a,x){return a+Number(x.grand_total||0);},0),invoiceReceived=pays.reduce(function(a,p){return a+Number(p.amount||0);},0),hireRevenue=hires.reduce(function(a,h){return a+Number(h.amount||0);},0),hireReceived=hires.reduce(function(a,h){return a+Number(h.amount_paid||0);},0),rentCost=rents.reduce(function(a,r){return a+Number(r.amount||0);},0),rentPaid=rents.reduce(function(a,r){return a+Number(r.amount_paid||0);},0),otherExpense=exps.reduce(function(a,e){return a+Number(e.amount||0);},0);
  var totalRevenue=billed+hireRevenue,received=invoiceReceived+hireReceived,m=document.getElementById('reportMetrics');
  if(m)m.innerHTML='<div class="metric-card"><div class="metric-label">Total revenue</div><div class="metric-value">'+managerMoney(totalRevenue)+'</div><div class="metric-note">'+managerMoney(billed)+' invoices + '+managerMoney(hireRevenue)+' equipment hires</div></div><div class="metric-card"><div class="metric-label">Cash received</div><div class="metric-value">'+managerMoney(received)+'</div><div class="metric-note">'+managerMoney(invoiceReceived)+' invoices + '+managerMoney(hireReceived)+' hires</div></div><div class="metric-card"><div class="metric-label">Supplier rental commitments</div><div class="metric-value">'+managerMoney(rentCost)+'</div><div class="metric-note">'+rents.length+' rental(s)</div></div><div class="metric-card"><div class="metric-label">Cash after recorded costs</div><div class="metric-value">'+managerMoney(received-rentPaid-otherExpense)+'</div><div class="metric-note">Cash basis after supplier rentals + other expenses</div></div>';
  var sm=document.getElementById('reportSummary');if(sm)sm.innerHTML='For <strong>'+esc(month)+'</strong>, invoice revenue was <strong>'+managerMoney(billed)+'</strong>, non-invoice equipment-hire revenue was <strong>'+managerMoney(hireRevenue)+'</strong>, and total recorded cash received was <strong>'+managerMoney(received)+'</strong>. This is a management cash-flow view, not a tax/accounting profit statement.';
  renderEventProfitTable();
}
function renderEventProfitTable(){var wrap=document.getElementById('eventProfitTable');if(!wrap)return;var map={};managerState.invoices.forEach(function(x){var k=(x.event_name||'').trim();if(!k)return;if(!map[k])map[k]={event:k,revenue:0,rental:0,paid:0};map[k].revenue+=Number(x.grand_total||0);map[k].paid+=invoicePaidAmount(x);});managerState.rentals.forEach(function(r){var k=(r.event_name||'').trim();if(!k||r.status==='cancelled')return;if(!map[k])map[k]={event:k,revenue:0,rental:0,paid:0};map[k].rental+=Number(r.amount||0);});managerState.equipmentHires.forEach(function(h){var k=(h.event_name||'').trim();if(!k||h.hire_status==='cancelled')return;if(!map[k])map[k]={event:k,revenue:0,rental:0,paid:0};map[k].revenue+=Number(h.amount||0);map[k].paid+=Number(h.amount_paid||0);});var rows=Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return (b.revenue-b.rental)-(a.revenue-a.rental);});if(!rows.length){wrap.innerHTML='<div class="manager-empty">Add the same Event name to invoices, supplier rentals, or equipment hires to see an event-by-event margin snapshot.</div>';return;}wrap.innerHTML='<div class="manager-table-wrap"><table class="manager-table" style="min-width:720px"><thead><tr><th>Event</th><th>Invoiced revenue</th><th>Collected</th><th>Rental cost</th><th>Gross margin before other costs</th></tr></thead><tbody>'+rows.map(function(x){return '<tr><td><strong>'+esc(x.event)+'</strong></td><td class="manager-money">'+managerMoney(x.revenue)+'</td><td class="manager-money">'+managerMoney(x.paid)+'</td><td class="manager-money">'+managerMoney(x.rental)+'</td><td class="manager-money">'+managerMoney(x.revenue-x.rental)+'</td></tr>';}).join('')+'</tbody></table></div>';}
function dbViewerValue(v){
  if(v===null||typeof v==='undefined')return '—';
  if(typeof v==='object')return JSON.stringify(v,null,2);
  return String(v);
}
function dbViewerPrettyHeader(k){return String(k||'').replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});}
async function loadDatabaseViewer(){
  var wrap=document.getElementById('dbViewerTableWrap'),st=document.getElementById('dbViewerStatus');
  if(!wrap)return;
  if(!sbConfigured()){wrap.innerHTML='<div class="manager-empty">Connect Supabase in the Cloud tab first.</div>';if(st)st.textContent='';return;}
  var table=gv('dbViewerTable')||'invoice_documents'; managerState.dbTable=table;
  wrap.innerHTML='<div class="manager-empty"><i class="ti ti-loader"></i> Loading '+esc(table)+'...</div>';
  try{
    var ws=gv('sbWorkspace').trim(),base=sbBase()+'/rest/v1/'+table;
    var params=[];
    if(table==='invoice_app_state') params.push('workspace_id=eq.'+encodeURIComponent(ws));
    else params.push('workspace_id=eq.'+encodeURIComponent(ws));
    params.push('select=*');
    params.push('limit=1000');
    if(table!=='invoice_app_state') params.push('order=created_at.desc');
    var r=await fetch(base+'?'+params.join('&'),{headers:sbHeaders(gv('sbKey').trim())});
    if(!r.ok)throw new Error(await r.text());
    managerState.dbRows=await r.json();
    if(st)st.textContent=managerState.dbRows.length+' row(s) loaded from '+table+'.';
    renderDatabaseViewer();
  }catch(e){console.error('Database viewer failed',e);managerState.dbRows=[];wrap.innerHTML='<div class="manager-empty">Could not read this table: '+esc(e.message)+'</div>';if(st)st.textContent='';}
}
function dbViewerVisibleKeys(rows){
  var table=managerState.dbTable||'invoice_documents';
  var preferred={
    invoice_documents:['id','doc_number','doc_type','client_name','event_name','grand_total','amount_paid','payment_status','issue_date','due_date','created_at','updated_at'],
    payment_receipts:['id','receipt_no','payment_date','client_name','event_name','amount','payment_method','reference_no','bank_account','notes','created_at','updated_at'],
    invoice_payments:['id','invoice_id','amount','payment_date','payment_method','reference','notes','created_at'],
    equipment_rentals:['id','supplier_name','supplier_contact','item_description','event_name','rent_date','return_date','amount','amount_paid','status','notes','created_at','updated_at'],
    owned_equipment_hires:['id','customer_name','customer_contact','item_description','event_name','quantity','hire_date','return_date','amount','amount_paid','payment_status','hire_status','payment_method','reference','notes','created_at','updated_at'],
    other_expenses:['id','expense_date','category','description','event_name','amount','payment_method','reference','notes','created_at','updated_at'],
    app_profiles:['user_id','email','full_name','role','active','created_at','updated_at'],
    employee_invites:['id','employee_name','invite_code','expires_at','used_at','created_at'],
    invoice_app_state:['workspace_id','updated_at']
  };
  var existing={};rows.forEach(function(r){Object.keys(r).forEach(function(k){existing[k]=true;});});
  var keys=(preferred[table]||[]).filter(function(k){return existing[k];});
  Object.keys(existing).forEach(function(k){if(keys.indexOf(k)<0 && k!=='snapshot' && k!=='data')keys.push(k);});
  return keys;
}
function renderDatabaseViewer(){
  var wrap=document.getElementById('dbViewerTableWrap');if(!wrap)return;
  var q=(gv('dbViewerSearch')||'').toLowerCase();
  var rows=(managerState.dbRows||[]).filter(function(row){if(!q)return true;try{return JSON.stringify(row).toLowerCase().indexOf(q)>=0;}catch(e){return true;}});
  if(!rows.length){wrap.innerHTML='<div class="manager-empty">No database rows match this view.</div>';return;}
  var keys=dbViewerVisibleKeys(rows);
  var head=keys.map(function(k){return '<th>'+esc(dbViewerPrettyHeader(k))+'</th>';}).join('')+'<th>Full Record</th>';
  var body=rows.map(function(r,rowIndex){return '<tr>'+keys.map(function(k){var v=r[k],txt=dbViewerValue(v);return '<td class="db-cell" title="'+esc(typeof txt==='string'?txt.slice(0,500):String(txt))+'">'+esc(txt)+'</td>';}).join('')+'<td><button class="db-object-btn" onclick="openDatabaseRecord('+rowIndex+')"><i class="ti ti-eye"></i> View</button></td></tr>';}).join('');
  wrap.innerHTML='<div class="manager-table-wrap"><table class="manager-table" style="min-width:1100px"><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  wrap.dataset.filteredRows=JSON.stringify(rows.map(function(r){return managerState.dbRows.indexOf(r);}));
  var st=document.getElementById('dbViewerStatus');if(st)st.textContent=rows.length+' of '+managerState.dbRows.length+' row(s) shown from '+managerState.dbTable+'. Large JSON fields are hidden from the grid; use View to inspect the full record.';
}
function openDatabaseRecord(filteredIndex){
  var wrap=document.getElementById('dbViewerTableWrap');
  var indexes=[];try{indexes=JSON.parse(wrap.dataset.filteredRows||'[]');}catch(e){}
  var actualIndex=(indexes[filteredIndex]!==undefined)?indexes[filteredIndex]:filteredIndex;
  var row=(managerState.dbRows||[])[actualIndex];if(!row)return;
  closeDatabaseRecord();
  var fields=Object.keys(row);
  var body=fields.map(function(k){var txt=dbViewerValue(row[k]);return '<div class="db-record-key">'+esc(dbViewerPrettyHeader(k))+'</div><div class="db-record-value">'+esc(txt)+'</div>';}).join('');
  var modal=document.createElement('div');modal.id='dbRecordModal';modal.className='db-record-modal';modal.onclick=function(e){if(e.target===modal)closeDatabaseRecord();};
  modal.innerHTML='<div class="db-record-card"><div class="db-record-head"><div><strong>Database Record</strong><div class="db-meta">'+esc(managerState.dbTable||'')+'</div></div><button class="btn btn-sm" onclick="closeDatabaseRecord()"><i class="ti ti-x"></i> Close</button></div><div class="db-record-body"><div class="db-record-grid">'+body+'</div></div></div>';
  document.body.appendChild(modal);
}
function closeDatabaseRecord(){var m=document.getElementById('dbRecordModal');if(m)m.remove();}
function exportDatabaseTableCSV(){
  var rows=managerState.dbRows||[];if(!rows.length){alert('There are no rows to export.');return;}
  var q=(gv('dbViewerSearch')||'').toLowerCase();rows=rows.filter(function(row){if(!q)return true;try{return JSON.stringify(row).toLowerCase().indexOf(q)>=0;}catch(e){return true;}});
  var keys=[];rows.forEach(function(r){Object.keys(r).forEach(function(k){if(keys.indexOf(k)<0)keys.push(k);});});
  var csv=[keys].concat(rows.map(function(r){return keys.map(function(k){var v=r[k];return typeof v==='object'&&v!==null?JSON.stringify(v):v;});})).map(function(row){return row.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(managerState.dbTable||'database')+'-'+managerToday()+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}


function adminTablePrimaryKey(table){ return table==='invoice_app_state' ? 'workspace_id' : 'id'; }
function adminProtectedField(k){ return k==='id' || k==='workspace_id' || k==='created_at'; }
function adminInputType(k,v){
  if(typeof v==='object' && v!==null) return 'json';
  if(/date$/i.test(k) || /_date$/i.test(k)) return 'date';
  if(/amount|total|quantity|qty|paid/i.test(k) && (typeof v==='number' || v===null || v==='')) return 'number';
  return 'text';
}
async function loadAdminTable(){
  var wrap=document.getElementById('adminTableWrap'),st=document.getElementById('adminStatus');if(!wrap)return;
  if(!sbConfigured()){wrap.innerHTML='<div class="manager-empty">Connect Supabase in the Cloud tab first.</div>';if(st)st.textContent='';return;}
  var table=gv('adminTable')||'invoice_documents';managerState.adminTable=table;
  wrap.innerHTML='<div class="manager-empty"><i class="ti ti-loader"></i> Loading '+esc(table)+'...</div>';
  try{
    var ws=gv('sbWorkspace').trim(),params=['workspace_id=eq.'+encodeURIComponent(ws),'select=*','limit=1000'];
    if(table!=='invoice_app_state')params.push('order=created_at.desc');
    var r=await fetch(sbBase()+'/rest/v1/'+table+'?'+params.join('&'),{headers:sbHeaders(gv('sbKey').trim())});
    if(!r.ok)throw new Error(await r.text());
    managerState.adminRows=await r.json();
    if(st)st.textContent=managerState.adminRows.length+' record(s) loaded from '+table+'.';
    renderAdminTable();
  }catch(e){console.error('Admin load failed',e);managerState.adminRows=[];wrap.innerHTML='<div class="manager-empty">Could not load admin records: '+esc(e.message)+'</div>';if(st)st.textContent='';}
}
function renderAdminTable(){
  var wrap=document.getElementById('adminTableWrap');if(!wrap)return;
  var q=(gv('adminSearch')||'').toLowerCase();
  var rows=(managerState.adminRows||[]).filter(function(r){if(!q)return true;try{return JSON.stringify(r).toLowerCase().indexOf(q)>=0;}catch(e){return true;}});
  if(!rows.length){wrap.innerHTML='<div class="manager-empty">No records match this view.</div>';return;}
  var keys=dbViewerVisibleKeysForTable(rows,managerState.adminTable);
  var head=keys.map(function(k){return '<th>'+esc(dbViewerPrettyHeader(k))+'</th>';}).join('')+'<th>Admin Actions</th>';
  var indexes=rows.map(function(r){return managerState.adminRows.indexOf(r);});
  wrap.dataset.adminFilteredRows=JSON.stringify(indexes);
  var body=rows.map(function(r,i){return '<tr>'+keys.map(function(k){var txt=dbViewerValue(r[k]);return '<td class="db-cell" title="'+esc(String(txt).slice(0,500))+'">'+esc(txt)+'</td>';}).join('')+'<td style="white-space:nowrap"><button class="btn btn-sm btn-primary" onclick="openAdminEditor('+i+')"><i class="ti ti-edit"></i> Edit</button> <button class="btn btn-sm btn-danger" onclick="deleteAdminRecord('+i+')"><i class="ti ti-trash"></i> Delete</button></td></tr>';}).join('');
  wrap.innerHTML='<div class="manager-table-wrap"><table class="manager-table" style="min-width:1150px"><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  var st=document.getElementById('adminStatus');if(st)st.textContent=rows.length+' of '+managerState.adminRows.length+' record(s) shown from '+managerState.adminTable+'.';
}
function dbViewerVisibleKeysForTable(rows,table){
  var old=managerState.dbTable;managerState.dbTable=table;var keys=dbViewerVisibleKeys(rows);managerState.dbTable=old;return keys;
}
function adminActualIndex(filteredIndex){var wrap=document.getElementById('adminTableWrap'),idx=[];try{idx=JSON.parse(wrap.dataset.adminFilteredRows||'[]');}catch(e){}return idx[filteredIndex]!==undefined?idx[filteredIndex]:filteredIndex;}
function openAdminEditor(filteredIndex){
  var actual=adminActualIndex(filteredIndex),row=(managerState.adminRows||[])[actual];if(!row)return;
  closeAdminEditor();
  var fields=Object.keys(row),controls=fields.map(function(k){
    var v=row[k],label='<div class="admin-field-label">'+esc(dbViewerPrettyHeader(k))+'</div>';
    if(adminProtectedField(k))return label+'<div class="admin-field-control"><div class="admin-locked">'+esc(dbViewerValue(v))+' <span style="font-size:10px">(protected)</span></div></div>';
    var typ=adminInputType(k,v),val=(typ==='json'?JSON.stringify(v,null,2):(v==null?'':String(v))),control;
    if(typ==='json') control='<textarea data-admin-field="'+esc(k)+'" data-admin-type="json">'+esc(val)+'</textarea>';
    else if(typ==='date') control='<input type="date" data-admin-field="'+esc(k)+'" data-admin-type="date" value="'+esc(val?String(val).slice(0,10):'')+'">';
    else if(typ==='number') control='<input type="number" step="0.01" data-admin-field="'+esc(k)+'" data-admin-type="number" value="'+esc(val)+'">';
    else control='<input type="text" data-admin-field="'+esc(k)+'" data-admin-type="text" value="'+esc(val)+'">';
    return label+'<div class="admin-field-control">'+control+'</div>';
  }).join('');
  var modal=document.createElement('div');modal.id='adminEditModal';modal.className='db-record-modal';modal.onclick=function(e){if(e.target===modal)closeAdminEditor();};
  modal.dataset.actualIndex=String(actual);
  modal.innerHTML='<div class="db-record-card"><div class="db-record-head"><div><strong>Edit Database Record</strong><div class="db-meta">'+esc(managerState.adminTable||'')+'</div></div><button class="btn btn-sm" onclick="closeAdminEditor()"><i class="ti ti-x"></i> Close</button></div><div class="db-record-body"><div class="admin-warning"><strong>Direct database edit.</strong> Saving changes updates Supabase immediately.</div><div class="admin-form-grid">'+controls+'</div><div class="admin-actions"><button class="btn" onclick="closeAdminEditor()">Cancel</button><button class="btn btn-primary" onclick="saveAdminRecord()"><i class="ti ti-device-floppy"></i> Save changes</button></div></div></div>';
  document.body.appendChild(modal);
}
function closeAdminEditor(){var m=document.getElementById('adminEditModal');if(m)m.remove();}
async function saveAdminRecord(){
  var modal=document.getElementById('adminEditModal');if(!modal)return;
  var actual=Number(modal.dataset.actualIndex),row=(managerState.adminRows||[])[actual];if(!row)return;
  var payload={};
  try{
    modal.querySelectorAll('[data-admin-field]').forEach(function(el){var k=el.dataset.adminField,t=el.dataset.adminType,v=el.value;if(t==='json'){v=v.trim()?JSON.parse(v):null;}else if(t==='number'){v=v===''?null:Number(v);}else if(t==='date'){v=v||null;} payload[k]=v;});
  }catch(e){alert('One of the JSON fields is not valid JSON. Please correct it before saving.');return;}
  if(!confirm('Save these changes directly to Supabase?'))return;
  var table=managerState.adminTable,pk=adminTablePrimaryKey(table),pkVal=row[pk];
  try{
    var url=sbBase()+'/rest/v1/'+table+'?'+encodeURIComponent(pk)+'=eq.'+encodeURIComponent(pkVal);
    var r=await fetch(url,{method:'PATCH',headers:sbHeaders(gv('sbKey').trim(),{'Prefer':'return=representation'}),body:JSON.stringify(payload)});
    if(!r.ok)throw new Error(await r.text());
    var changed=await r.json();if(changed&&changed[0])managerState.adminRows[actual]=changed[0];
    closeAdminEditor();await loadAdminTable();await loadManagerData();
    alert('Database record updated successfully.');
  }catch(e){console.error('Admin save failed',e);alert('Could not update this record: '+e.message);}
}
async function deleteAdminRecord(filteredIndex){
  var actual=adminActualIndex(filteredIndex),row=(managerState.adminRows||[])[actual];if(!row)return;
  var table=managerState.adminTable,pk=adminTablePrimaryKey(table),pkVal=row[pk];
  if(table==='invoice_app_state'){if(!confirm('Delete the app-state row for this workspace? This can remove synced settings/current draft. Continue?'))return;}
  else if(!confirm('Permanently delete this '+table+' record from Supabase? This cannot be undone.'))return;
  try{
    var url=sbBase()+'/rest/v1/'+table+'?'+encodeURIComponent(pk)+'=eq.'+encodeURIComponent(pkVal);
    var r=await fetch(url,{method:'DELETE',headers:sbHeaders(gv('sbKey').trim())});if(!r.ok)throw new Error(await r.text());
    await loadAdminTable();await loadManagerData();
  }catch(e){console.error('Admin delete failed',e);alert('Could not delete this record: '+e.message);}
}

function copyManagerSql(){navigator.clipboard.writeText(MANAGER_SQL).then(function(){document.getElementById('managerSetupStatus').innerHTML='<span class="pill pill-success">SQL copied</span>';}).catch(function(){alert('Please copy the SQL manually.');});}
function openManagerSqlEditor(){var ref=sbProjectRef();if(!ref){alert('Enter your Supabase Project URL in the Cloud tab first.');return;}navigator.clipboard.writeText(MANAGER_SQL).catch(function(){});window.open('https://supabase.com/dashboard/project/'+ref+'/sql/new','_blank');}
async function testManagerSchema(){var st=document.getElementById('managerSetupStatus');if(!sbConfigured()){st.innerHTML='<span class="pill pill-warn">Connect Supabase first</span>';return;}st.innerHTML='<span class="pill pill-info">Testing...</span>';try{await Promise.all([managerGet('app_profiles','user_id'),managerGet('payment_receipts','id'),managerGet('invoice_payments','id'),managerGet('equipment_rentals','id'),managerGet('owned_equipment_hires','id'),managerGet('other_expenses','id')]);st.innerHTML='<span class="pill pill-success"><i class="ti ti-check"></i> Manager tables are ready</span>';loadManagerData();}catch(e){st.innerHTML='<span class="pill pill-warn">Setup still required: '+esc(e.message)+'</span>';}}
window.addEventListener('DOMContentLoaded', function(){ if(document.getElementById('rentalDate')) resetRentalForm(); if(document.getElementById('equipmentHireDate')) resetEquipmentHireForm(); if(document.getElementById('expenseDate')) resetExpenseForm(); var fm=document.getElementById('financeMonth'); if(fm&&!fm.value)fm.value=localISOMonth(); var box=document.getElementById('managerSqlCode'); if(box) box.textContent=MANAGER_SQL; initProfileAuth(); });
