const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveCounsellorPin } = require('../utils/counsellorAuth');

test('uses a counsellor-specific pin when present', () => {
  assert.equal(resolveCounsellorPin({ name: 'Alice', pin: '123456' }, '112233'), '123456');
});

test('falls back to the shared pin when no counsellor pin exists', () => {
  assert.equal(resolveCounsellorPin({ name: 'Bob' }, '112233'), '112233');
});

test('supports pinNumber as an alternate property', () => {
  assert.equal(resolveCounsellorPin({ name: 'Carol', pinNumber: '654321' }, '112233'), '654321');
});
