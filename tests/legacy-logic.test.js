// @vitest-environment jsdom
// Unit tests for the business rules inside the classic browser scripts.
// The scripts are evaluated into the jsdom window exactly as the browser
// would load them, then their global functions are exercised directly.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const load = f => window.eval(fs.readFileSync(path.join(root, f), 'utf8') + '\n//# sourceURL=' + f);
const w = () => window;

function input(id, value, type = 'text') {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('input'); el.id = id; el.type = type; document.body.appendChild(el); }
  if (type === 'checkbox') el.checked = !!value; else el.value = value;
  return el;
}

beforeAll(() => {
  load('legacy/brand-assets.js');
  load('legacy/script.js');
  load('legacy/ai-quote.js');
});

beforeEach(() => {
  localStorage.clear();
  ['discEnabled', 'taxEnabled'].forEach(id => input(id, false, 'checkbox'));
});

describe('local calendar dates', () => {
  it('formats a local date (not UTC)', () => {
    expect(w().localISODate(new Date(2026, 0, 5, 1, 30))).toBe('2026-01-05');
    expect(w().localISOMonth(new Date(2026, 10, 1, 0, 10))).toBe('2026-11');
  });
  it('adds days across month and year boundaries', () => {
    expect(w().addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
    expect(w().addDaysISO('2026-12-20', 30)).toBe('2027-01-19');
    expect(w().addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('document numbering', () => {
  it('uses the documented formats', () => {
    expect(w().formatDocNumber('QUO', '2026', 228)).toBe('QUO-2026-228');
    expect(w().formatDocNumber('', '202607', 9)).toBe('202607-009');
    expect(w().formatDocNumber('PR', '2026', 7)).toBe('PR-2026-0007');
  });
  it('previewing a number does not consume it', async () => {
    const n1 = await w().generateDocNumber('Quotation', false);
    const n2 = await w().generateDocNumber('Quotation', false);
    expect(n1).toBe(n2);
  });
  it('commitDocNumber only moves the counter forward and only for matching numbers', () => {
    const period = w().docPeriod('Quotation');
    expect(w().commitDocNumber('Quotation', 'QUO-' + period + '-240')).toBe(true);
    expect(w().localFloor('Quotation')).toBe(240);
    w().commitDocNumber('Quotation', 'QUO-' + period + '-230');
    expect(w().localFloor('Quotation')).toBe(240);
    expect(w().commitDocNumber('Quotation', 'Custom-123')).toBe(false);
    expect(w().commitDocNumber('Quotation', 'QUO-' + period + '-241-Rev1')).toBe(true);
    expect(w().localFloor('Quotation')).toBe(241);
  });
  it('next number continues after the committed one', async () => {
    const period = w().docPeriod('Quotation');
    w().commitDocNumber('Quotation', 'QUO-' + period + '-300');
    expect(await w().generateDocNumber('Quotation', false)).toBe('QUO-' + period + '-301');
  });
});

describe('revision numbers', () => {
  it.each([
    ['QUO-2026-228', 'QUO-2026-228-Rev1'],
    ['QUO-2026-228-Rev1', 'QUO-2026-228-Rev2'],
    ['QUO-2026-228-R3', 'QUO-2026-228-R4'],
    ['QUO-2026-228 rev9', 'QUO-2026-228 Rev10']
  ])('%s → %s', (a, b) => expect(w().bumpDocRevision(a)).toBe(b));
});

describe('line totals', () => {
  it('qty × unit, with sensible defaults', () => {
    expect(w().itemTotal({ qty: 2, unit: 1500 })).toBe(3000);
    expect(w().itemTotal({ qty: '', unit: 1500 })).toBe(1500);
  });
  it('manual totals and multi-day prices win', () => {
    expect(w().itemTotal({ qty: 2, unit: 1500, manualTotal: true, total: 999 })).toBe(999);
    expect(w().itemTotal({ qty: 2, unit: 1500, multiDay: true, multiDayPrice: 5000 })).toBe(5000);
  });
});

describe('quotation totals', () => {
  function setCats(list) { w().cats = list; }
  const item = (qty, unit) => ({ qty, unit });
  it('adds additional and subtracts removed categories', () => {
    setCats([
      { name: 'Base', type: 'standard', items: [item(1, 100000), item(2, 25000)] },
      { name: 'Additional Items', type: 'additional', items: [item(1, 20000)] },
      { name: 'Removed Items', type: 'removed', items: [item(1, 30000)] }
    ]);
    const t = w().calcTotals();
    expect(t.standardSub).toBe(150000);
    expect(t.subtotal).toBe(140000);
    expect(t.grand).toBe(140000);
    expect(t.hasRevisions).toBe(true);
  });
  it('applies category discount, document discount and tax in order', () => {
    setCats([{ name: 'A', type: 'standard', discEnabled: true, discMode: 'pct', discVal: 10, discLabel: 'Promo', items: [item(1, 100000)] }]);
    input('discEnabled', true, 'checkbox'); input('discMode', 'amt'); input('discVal', '5000'); input('discLabel', 'Loyalty');
    input('taxEnabled', true, 'checkbox'); input('taxMode', 'pct'); input('taxVal', '18'); input('taxLabel', 'VAT');
    const t = w().calcTotals();
    expect(t.subtotal).toBe(90000);
    expect(t.discAmt).toBe(5000);
    expect(t.taxAmt).toBeCloseTo(15300, 6);
    expect(t.grand).toBeCloseTo(100300, 6);
  });
  it('uses a category budget instead of the summed items when enabled', () => {
    setCats([{ name: 'Lump', type: 'standard', budgetEnabled: true, budgetVal: 75000, items: [item(1, 100000)] }]);
    expect(w().calcTotals().grand).toBe(75000);
  });
});

describe('escaping', () => {
  it('escapes HTML-significant characters and keeps zero', () => {
    expect(w().esc('<img src=x onerror="a()">\'')).toBe('&lt;img src=x onerror=&quot;a()&quot;&gt;&#39;');
    expect(w().esc(0)).toBe('0');
    expect(w().esc(null)).toBe('');
  });
});

describe('invoice payment status', () => {
  it('prefers receipts, falls back to legacy payments', () => {
    w().managerState.paymentReceipts = [{ invoice_id: 'a', amount: 400 }, { invoice_id: 'a', amount: 600 }];
    w().managerState.payments = [{ invoice_id: 'a', amount: 50 }, { invoice_id: 'b', amount: 200 }];
    expect(w().invoicePaidAmount({ id: 'a' })).toBe(1000);
    expect(w().invoicePaidAmount({ id: 'b' })).toBe(200);
    expect(w().invoiceStatus({ id: 'a', grand_total: 1000 })).toBe('paid');
    expect(w().invoiceStatus({ id: 'b', grand_total: 1000 })).toBe('partial');
    expect(w().invoiceStatus({ id: 'c', grand_total: 1000, due_date: '2000-01-01' })).toBe('overdue');
  });
});

describe('AI quote offline parser', () => {
  it('extracts quantities, days and prices', () => {
    const cats = w().AiQuote.parseWithSmartNlp('2 Photographers for 2 days 90,000\nSound system with 4 mics 75,000');
    const items = cats.flatMap(c => c.items);
    expect(items.length).toBe(2);
    const sound = items.find(i => /sound/i.test(i.desc));
    expect(sound).toBeTruthy();
    expect(sound.qty * sound.unit * (sound.days || 1)).toBe(75000);
  });
});
