// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const load = f => window.eval(fs.readFileSync(path.join(root, f), 'utf8') + '\n//# sourceURL=' + f);

beforeAll(() => { load('legacy/brand-assets.js'); load('legacy/script.js'); load('v7-features.js'); });

describe('amount in words', () => {
  it.each([
    [0, 'Rs. ', 'Rupees Zero Only'],
    [15, 'Rs. ', 'Rupees Fifteen Only'],
    [710000, 'Rs. ', 'Rupees Seven Hundred Ten Thousand Only'],
    [1250.5, 'Rs. ', 'Rupees One Thousand Two Hundred Fifty and Cents Fifty Only'],
    [2345678.99, 'Rs. ', 'Rupees Two Million Three Hundred Forty-Five Thousand Six Hundred Seventy-Eight and Cents Ninety-Nine Only'],
    [1000001, '$ ', 'US Dollars One Million One Only'],
    [99.995, 'GBP ', 'Pounds One Hundred Only']
  ])('%s %s', (n, cur, words) => expect(window.amountInWords(n, cur)).toBe(words));
});

describe('item library', () => {
  it('learns priced items, updates prices and skips removed categories', () => {
    localStorage.clear();
    window.itemLibrary.learnFrom([
      { name: 'Sound', type: 'standard', items: [{ desc: 'Line array PA', tag: 'Hardware', unit: 85000 }, { desc: 'Free item', unit: 0 }] },
      { name: 'Removed Items', type: 'removed', items: [{ desc: 'Drone', unit: 45000 }] }
    ]);
    window.itemLibrary.learnFrom([{ name: 'Sound', type: 'standard', items: [{ desc: 'line  array pa', tag: 'Hardware', unit: 90000 }] }]);
    const lib = window.itemLibrary.list();
    expect(lib.map(x => x.desc)).toEqual(['Line array PA']);
    expect(lib[0].unit).toBe(90000);
    expect(lib[0].uses).toBe(2);
  });
});
