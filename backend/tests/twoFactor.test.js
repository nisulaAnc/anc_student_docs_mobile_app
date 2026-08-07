const test = require('node:test');
const assert = require('node:assert/strict');
const { generateTotp, verifyTotp } = require('../utils/twoFactor');

test('generates a six-digit TOTP value for a known secret', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  const code = generateTotp(secret, 0);
  assert.equal(code.length, 6);
  assert.equal(verifyTotp(secret, code, 0, 0), true);
});

test('rejects invalid codes', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  assert.equal(verifyTotp(secret, '000000', 0, 0), false);
});
