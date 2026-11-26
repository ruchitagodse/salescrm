import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyticsRange, exactRate, normalizedCoordinates, cashSeries, formatCount } from '../src/lib/analytics-values.ts';
const now = new Date('2026-11-25T20:00:00Z');
test('analytics defaults use India month to date', () => {
  const r = analyticsRange({}, now);
  assert.equal(r.start, '2026-11-01'); assert.equal(r.end, '2026-11-26');
});
test('inclusive India dates cross month and year boundaries', () => {
  const r = analyticsRange({ start: '2025-12-31', end: '2026-01-01' }, now);
  assert.equal(r.startInstant, '2025-12-30T18:30:00.000Z');
  assert.equal(r.endExclusive, '2026-01-01T18:30:00.000Z');
  assert.deepEqual(r.months, ['2025-12', '2026-01']);
});
test('invalid, incomplete, reversed and excessive ranges reject', () => {
  for (const input of [{start:'2026-02-30',end:'2026-03-01'}, {start:'2026-01-01'}, {start:'2026-01-02',end:'2026-01-01'}, {start:'2000-01-01',end:'2026-01-01'}, {start:['2026-01-01'],end:'2026-01-01'}]) assert.throws(() => analyticsRange(input,now));
});
test('conversion rates round exactly and handle empty cohorts', () => {
  assert.equal(exactRate('1','3'),'33.33%'); assert.equal(exactRate('2','3'),'66.67%');
  assert.equal(exactRate('0','0'),'—'); assert.equal(exactRate('99999999999999999999','99999999999999999999'),'100.00%');
  assert.throws(() => exactRate('2','1'));
});
test('plot ratios preserve bounded precision without Number money', () => {
  assert.deepEqual(normalizedCoordinates(['0','100000000000000000000','50000000000000000000']),[0,10000,5000]);
  assert.deepEqual(normalizedCoordinates(['0','0']),[0,0]); assert.throws(() => normalizedCoordinates(['-1']));
});
test('cash series fills months and computes negative net exactly', () => {
  assert.deepEqual(cashSeries(['2026-01','2026-02'],[{month:'2026-02',receipts:'900719925474099300',expenses:'900719925474099301'}]),[
    {month:'2026-01',receipts:'0',expenses:'0',netCash:'0'}, {month:'2026-02',receipts:'900719925474099300',expenses:'900719925474099301',netCash:'-1'}]);
  assert.equal(formatCount('125000'),'1,25,000');
});
