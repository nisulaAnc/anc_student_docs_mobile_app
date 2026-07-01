const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCounsellorSheetRow, resolveCounsellorPinReset } = require('../utils/counsellorSheet');

test('creates a sheet row with name, email and pin', () => {
  const row = buildCounsellorSheetRow([], { name: 'Alice', email: 'alice@example.com', pin: '123456' });
  assert.equal(row[2], 'Alice');
  assert.equal(row[4], 'alice@example.com');
  assert.equal(row[5], '123456');
});

test('preserves the existing name when only the pin changes', () => {
  const row = buildCounsellorSheetRow(['', '', 'Alice', '', 'alice@example.com', '111111'], { email: 'alice@example.com', pin: '654321' });
  assert.equal(row[2], 'Alice');
  assert.equal(row[4], 'alice@example.com');
  assert.equal(row[5], '654321');
});

test('writes the pin to the mapped Google Sheet PIN column when headers are present', () => {
  const row = buildCounsellorSheetRow(['', '', '', '', '', ''], { name: 'Alice', email: 'alice@example.com', pin: '654321' }, ['Name', 'Role', 'Email', 'Phone', 'PIN']);
  assert.equal(row[2], 'alice@example.com');
  assert.equal(row[4], '654321');
});

test('accepts a reset when the old PIN matches the stored PIN', () => {
  const result = resolveCounsellorPinReset({ pin: '111111' }, { email: 'alice@example.com', oldPin: '111111', newPin: '654321' });
  assert.equal(result.email, 'alice@example.com');
  assert.equal(result.pin, '654321');
});

test('rejects a reset when the old PIN does not match', () => {
  assert.throws(
    () => resolveCounsellorPinReset({ pin: '111111' }, { email: 'alice@example.com', oldPin: '000000', newPin: '654321' }),
    /Old PIN is incorrect/
  );
});
